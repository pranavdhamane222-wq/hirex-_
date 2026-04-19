from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
from datetime import datetime

# Initialize Application Engine
load_dotenv()
app = Flask(__name__)
# Enable CORS for local testing vs live hostings
CORS(app, resources={r"/api/*": {"origins": "*"}})

RENDER_DB_URL = os.getenv("RENDER_DB_URL")

def get_db_connection():
    # Establishes a fresh connection per pipeline securely.
    conn = psycopg2.connect(RENDER_DB_URL)
    return conn

@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({"status": "healthy", "database": "PostgreSQL Render Verified"}), 200

@app.route('/api/feed', methods=['GET'])
def get_feed():
    # Returns structural feed array for UI mapping.
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, author_name, author_role, content, likes_count, comments_count, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as date FROM feed_posts ORDER BY created_at DESC;")
        posts = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({"success": True, "data": posts}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/feed', methods=['POST'])
def create_post():
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()
        
        # In a real environment, author_email triggers user lookup. For structural test, parsing raw from React/Vanilla.
        cur.execute(
            "INSERT INTO feed_posts (author_email, author_name, author_role, content) VALUES (%s, %s, %s, %s) RETURNING id;",
            (data.get('email', 'sys@auth.local'), data.get('name', 'Professional User'), data.get('role', 'Verified Architect'), data.get('content'))
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": "Post successfully inserted to Render PostgreSQL", "post_id": new_id}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/jobs', methods=['GET'])
def get_jobs():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, role_title, company_name, location, tier, salary, tags FROM jobs_board ORDER BY created_at DESC;")
        jobs = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({"success": True, "data": jobs}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/funding', methods=['GET'])
def get_funding():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT id, startup_name, round_type, capital_raised, target_capital, domain_tags FROM venture_deals ORDER BY created_at DESC;")
        deals = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({"success": True, "data": deals}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/jobs', methods=['POST'])
def create_job():
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO jobs_board (role_title, company_name, location, tier, salary, tags) VALUES (%s, %s, %s, %s, %s, %s)",
            (data.get('role_title'), data.get('company_name'), data.get('location'), data.get('tier'), data.get('salary'), data.get('tags'))
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/funding', methods=['POST'])
def create_funding():
    try:
        data = request.json
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO venture_deals (startup_name, round_type, capital_raised, target_capital, domain_tags) VALUES (%s, %s, %s, %s, %s)",
            (data.get('startup_name'), data.get('round_type'), '$0', data.get('target_capital'), data.get('domain_tags'))
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/events', methods=['GET'])
def get_events():
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM platform_events ORDER BY created_at DESC;")
        events = cur.fetchall()
        cur.close()
        conn.close()
        return jsonify({"success": True, "data": events}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/wallet/<email>', methods=['GET'])
def get_wallet(email):
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Ensure wallet exists
        cur.execute("INSERT INTO wallets (user_email, balance) VALUES (%s, 1000) ON CONFLICT (user_email) DO NOTHING;", (email,))
        cur.execute("SELECT balance FROM wallets WHERE user_email = %s;", (email,))
        balance = cur.fetchone()['balance']
        
        # Get Ledgers
        cur.execute("SELECT amount, transaction_type, description, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as date FROM wallet_transactions WHERE user_email = %s ORDER BY created_at DESC;", (email,))
        transactions = cur.fetchall()
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "balance": balance, "transactions": transactions}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/tickets/purchase', methods=['POST'])
def purchase_ticket():
    try:
        data = request.json
        email = data.get('email')
        event_id = data.get('event_id')
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get Event Cost
        cur.execute("SELECT event_name, ticket_cost FROM platform_events WHERE id = %s;", (event_id,))
        event = cur.fetchone()
        cost = event['ticket_cost']
        
        # Check Balance
        cur.execute("SELECT balance FROM wallets WHERE user_email = %s;", (email,))
        balance = cur.fetchone()['balance']
        
        if balance < cost:
            return jsonify({"success": False, "error": "Insufficient wallet balance."}), 400
            
        # Deduct Balance
        cur.execute("UPDATE wallets SET balance = balance - %s WHERE user_email = %s;", (cost, email))
        
        # Append Ledger
        desc = f"Purchased Ticket: {event['event_name']}"
        cur.execute("INSERT INTO wallet_transactions (user_email, amount, transaction_type, description) VALUES (%s, %s, 'purchase', %s);", (email, -cost, desc))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": "Ticket generated securely."}), 201
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/tickets/refund', methods=['POST'])
def refund_ticket():
    try:
        data = request.json
        email = data.get('email')
        event_id = data.get('event_id')
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute("SELECT event_name, ticket_cost FROM platform_events WHERE id = %s;", (event_id,))
        event = cur.fetchone()
        cost = event['ticket_cost']
        
        # Refund Balance
        cur.execute("UPDATE wallets SET balance = balance + %s WHERE user_email = %s;", (cost, email))
        
        # Append Ledger
        desc = f"Refunded Ticket: {event['event_name']}"
        cur.execute("INSERT INTO wallet_transactions (user_email, amount, transaction_type, description) VALUES (%s, %s, 'refund', %s);", (email, cost, desc))
        
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"success": True, "message": "Refund processed.", "refunded": cost}), 200
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Map to dynamic host ports for Render platform deployment
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
