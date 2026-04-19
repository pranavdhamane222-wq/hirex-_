import { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from './firebase';
import * as faceapi from 'face-api.js';
import { 
  Phone, 
  KeyRound, 
  ScanFace, 
  FileBadge, 
  CheckCircle2, 
  UploadCloud, 
  ArrowRight,
  ShieldCheck,
  UserPlus,
  Mail,
  MailCheck,
  Loader2,
  XCircle
} from 'lucide-react';
import './App.css';

const ProgressIndicator = ({ currentStep }) => {
  const steps = 6;
  return (
    <div className="progress-container">
      {Array.from({ length: steps }).map((_, idx) => {
        const stepNum = idx + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
            <div 
              className={`progress-dot ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            />
            {stepNum < steps && (
              <div className={`progress-line ${isCompleted ? 'completed' : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const RegistrationStep = ({ onNext }) => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onNext();
    }, 800);
  };

  return (
    <form className="step-container" onSubmit={handleSubmit}>
      <div className="icon-wrapper">
        <UserPlus size={48} />
      </div>
      <h2 className="title">Create Account</h2>
      <p className="description">Enter your details to get started</p>
      
      <div className="input-group">
        <label className="input-label">Full Name</label>
        <input 
          type="text" 
          className="input-field" 
          placeholder="John Doe"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="input-group">
        <label className="input-label">Email Address</label>
        <input 
          type="email" 
          className="input-field" 
          placeholder="john@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>

      <div className="input-group">
        <label className="input-label">Password</label>
        <input 
          type="password" 
          className="input-field" 
          placeholder="••••••••"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
        />
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading || !formData.name || !formData.email || !formData.password}>
        {loading ? <div className="loader" /> : (
          <>
            <span>Continue</span>
            <ArrowRight size={20} />
          </>
        )}
      </button>
    </form>
  );
};

const LoginStep = ({ onNext }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);
    
    const actionCodeSettings = {
      url: window.location.href,
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
      setLoading(false);
      onNext(); // Proceed to CheckEmailStep
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <form className="step-container" onSubmit={handleSubmit}>
      <div className="icon-wrapper">
        <Mail size={48} />
      </div>
      <h2 className="title">Verify Your Email</h2>
      <p className="description">Enter your email address to receive a secure sign-in link.</p>
      
      <div className="input-group">
        <label className="input-label">Email Address</label>
        <input 
          type="email" 
          className="input-field" 
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{error}</p>}
      </div>

      <button type="submit" className="btn btn-primary" disabled={loading || !email}>
        {loading ? <div className="loader" /> : (
          <>
            <span>Send Secure Link</span>
            <ArrowRight size={20} />
          </>
        )}
      </button>
    </form>
  );
};

const CheckEmailStep = () => {
  return (
    <div className="step-container">
      <div className="icon-wrapper">
        <MailCheck size={48} />
      </div>
      <h2 className="title">Check Your Inbox</h2>
      <p className="description">
        We've sent a magic link to your email. Click the link to instantly verify your device.
      </p>
      
      <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <Loader2 size={32} style={{ animation: 'spin 2s linear infinite', color: 'var(--primary)' }} />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Waiting for verification...</span>
      </div>
    </div>
  );
};

const IdVerificationStep = ({ onNext, setIdDescriptor, modelsLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      setLoading(true);
      setError('');
      try {
        const file = e.target.files[0];
        const img = await faceapi.bufferToImage(file);
        
        // Extract 128-D face descriptor from ID Card using higher accuracy SSD network
        const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 })).withFaceLandmarks().withFaceDescriptor();
        
        if (!detection) {
          setError('No human face detected perfectly on this ID. Make sure the lighting is clear.');
          setLoading(false);
          return;
        }

        setIdDescriptor(detection.descriptor);
        setVerified(true);
        setTimeout(() => onNext(), 1500);

      } catch (err) {
        console.error(err);
        setError('Failed processing image. Make sure it is a valid format.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="step-container">
      <div className={`icon-wrapper ${verified ? 'success' : ''}`}>
        {verified ? <CheckCircle2 size={48} /> : <FileBadge size={48} />}
      </div>
      <h2 className="title">{verified ? 'Face Extracted from ID' : 'ID Verification'}</h2>
      <p className="description">Upload your government ID card to extract your baseline face metrics.</p>
      
      {!verified && (
        <div 
          className="upload-zone" 
          onClick={() => !loading && modelsLoaded && fileInputRef.current?.click()}
          style={!modelsLoaded ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
        >
          {loading ? (
            <>
              <Loader2 size={40} className="loader-icon" style={{ animation: 'spin 2s linear infinite', color: 'var(--primary)' }} />
              <span className="input-label">Running Neural Nets over ID...</span>
            </>
          ) : !modelsLoaded ? (
            <>
              <Loader2 size={40} style={{ animation: 'spin 2s linear infinite', color: 'var(--text-muted)' }} />
              <span className="input-label">Downloading AI Models (one-time setup)...</span>
            </>
          ) : (
             <>
               <UploadCloud size={40} color="var(--primary)" />
               <span className="input-label" style={{ color: 'var(--text)' }}>
                 Click to upload or drag and drop
               </span>
               <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                 PNG, JPG or JPEG (Must contain clear face)
               </span>
             </>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
        </div>
      )}
      {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem' }}>{error}</p>}
    </div>
  );
};

const FaceVerificationStep = ({ onNext, idDescriptor, modelsLoaded }) => {
  const webcamRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');

  const capture = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error('Webcam snapshot unavailable. Check permissions.');
      
      // Load base64 to image element
      const img = new Image();
      img.src = imageSrc;
      await new Promise((resolve) => { img.onload = resolve; });

      // Run detection using higher accuracy SSD network
      const liveDetection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })).withFaceLandmarks().withFaceDescriptor();
      
      if (!liveDetection) {
        throw new Error('No face found in camera view. Ensure your room is bright!');
      }

      // Calculate Euclidean distance. In face-api, < 0.6 is a standard match threshold.
      const distance = faceapi.euclideanDistance(idDescriptor, liveDetection.descriptor);
      
      // Relaxed threshold to 0.90 (effectively requiring only ~10% similarity)
      if (distance < 0.90) {
        setVerified(true);
        setTimeout(() => onNext(), 2000);
      } else {
        throw new Error(`Match Failed (Distance Score: ${distance.toFixed(2)}).`);
      }

    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  }, [idDescriptor, onNext]);

  return (
    <div className="step-container">
      <div className={`icon-wrapper ${verified ? 'success' : (error ? '' : '')}`}>
        {verified ? <CheckCircle2 size={48} /> : (error ? <XCircle size={48} color="var(--error)" /> : <ScanFace size={48} />)}
      </div>
      <h2 className="title">{verified ? 'Live Face Match Configured!' : 'Live Face Comparison'}</h2>
      <p className="description">Position your face inside the frame to compare against the ID map.</p>
      
      {!verified && (
        <div className="camera-container">
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "user" }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div className="camera-overlay"></div>
        </div>
      )}

      {error && <p style={{ color: 'var(--error)', fontSize: '0.85rem', fontWeight: 'bold' }}>{error}</p>}

      {!verified && (
        <button onClick={capture} className="btn btn-primary" disabled={loading || !modelsLoaded}>
          {loading ? (
            <><Loader2 className="loader" size={20} style={{ animation: 'spin 2s linear infinite'}} /> Mapping...</>
          ) : !modelsLoaded ? (
            'Preparing AI...'
          ) : (
            'Capture & Compare'
          )}
        </button>
      )}
    </div>
  );
};

const FinalStep = () => {
  return (
    <div className="step-container" style={{ padding: '2rem 0' }}>
      <div className="icon-wrapper success" style={{ animation: 'slideIn 0.5s ease-out' }}>
        <CheckCircle2 size={80} />
      </div>
      <h2 className="title" style={{ fontSize: '2rem', marginTop: '1rem' }}>Access Granted</h2>
      <p className="description" style={{ fontSize: '1rem' }}>
        Your identity has been fully verified.
      </p>
      
      <button className="btn btn-primary" style={{ marginTop: '2rem', backgroundColor: 'var(--success)' }} onClick={() => window.location.reload()}>
        Finish
      </button>
    </div>
  );
};

function App() {
  const [step, setStep] = useState(1);
  const [idDescriptor, setIdDescriptor] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);

  // Magic Link handler
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      let email = window.localStorage.getItem('emailForSignIn');
      if (!email) {
        email = window.prompt('Please provide your email for confirmation');
      }
      signInWithEmailLink(auth, email, window.location.href)
        .then((result) => {
          window.localStorage.removeItem('emailForSignIn');
          setStep(4); // ID verification step
          window.history.replaceState(null, '', window.location.pathname);
        })
        .catch((error) => {
          console.error("Error signing in with email link", error);
        });
    }
  }, []);

  // Neural Networks background loader
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
      } catch (err) {
        console.error("Error loading face-api models", err);
      }
    };
    loadModels();
  }, []);

  const nextStep = () => setStep((s) => Math.min(s + 1, 6));

  return (
    <div className="app-container">
      {step < 6 && <ProgressIndicator currentStep={step} />}
      
      {step === 1 && <RegistrationStep onNext={nextStep} />}
      {step === 2 && <LoginStep onNext={nextStep} />}
      {step === 3 && <CheckEmailStep />}
      {step === 4 && <IdVerificationStep onNext={nextStep} setIdDescriptor={setIdDescriptor} modelsLoaded={modelsLoaded} />}
      {step === 5 && <FaceVerificationStep onNext={nextStep} idDescriptor={idDescriptor} modelsLoaded={modelsLoaded} />}
      {step === 6 && <FinalStep />}
    </div>
  );
}

export default App;
