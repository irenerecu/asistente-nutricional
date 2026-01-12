from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS # Necesario para que React y Python se hablen

app = Flask(__name__)
CORS(app)

# Configuración de SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///nutricion.db'
db = SQLAlchemy(app)

# Modelo de base de datos
class Usuario(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    peso = db.Column(db.Float)
    altura = db.Column(db.Float)
    edad = db.Column(db.Integer)
    actividad = db.Column(db.String(50))

@app.route('/api/perfil', methods=['POST'])
def guardar_perfil():
    data = request.json
    # Aquí iría la lógica para guardar en SQLite
    return jsonify({"status": "éxito"}), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all() # Esto crea el archivo nutricion.db automáticamente
    app.run(debug=True)
