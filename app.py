import os
import sqlite3
from contextlib import contextmanager

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

PASTA = os.path.dirname(os.path.abspath(__file__))

# ==========================
# BANCO DE DADOS
# ==========================
# Com DATABASE_URL definida (Neon/Render) usa PostgreSQL.
# Sem ela (uso local) usa um arquivo SQLite: techrent.db

DATABASE_URL = os.environ.get("DATABASE_URL")
USA_PG = bool(DATABASE_URL)

if USA_PG:
    import psycopg2
    from psycopg2.extras import RealDictCursor

CHAVE_PRIMARIA = (
    "SERIAL PRIMARY KEY" if USA_PG
    else "INTEGER PRIMARY KEY AUTOINCREMENT"
)


class Db:

    def __init__(self, cur):
        self.cur = cur

    def run(self, sql, params=()):
        if USA_PG:
            sql = sql.replace("?", "%s")
        self.cur.execute(sql, params)
        return self

    def todos(self):
        return [dict(linha) for linha in self.cur.fetchall()]

    def um(self):
        linha = self.cur.fetchone()
        return dict(linha) if linha else None

    @property
    def n(self):
        return self.cur.rowcount


@contextmanager
def banco():

    if USA_PG:
        con = psycopg2.connect(DATABASE_URL)
        cur = con.cursor(cursor_factory=RealDictCursor)
    else:
        con = sqlite3.connect(os.path.join(PASTA, "techrent.db"))
        con.row_factory = sqlite3.Row
        cur = con.cursor()

    try:
        yield Db(cur)
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        cur.close()
        con.close()


def iniciar_banco():

    with banco() as db:

        db.run(f"""
            CREATE TABLE IF NOT EXISTS usuarios (
                id {CHAVE_PRIMARIA},
                nome TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                telefone TEXT NOT NULL,
                cpf TEXT NOT NULL UNIQUE,
                senha TEXT NOT NULL,
                tipo TEXT NOT NULL
            )
        """)

        db.run(f"""
            CREATE TABLE IF NOT EXISTS equipamentos (
                id {CHAVE_PRIMARIA},
                nome TEXT NOT NULL,
                categoria TEXT NOT NULL,
                status TEXT NOT NULL
            )
        """)

        db.run(f"""
            CREATE TABLE IF NOT EXISTS reservas (
                id {CHAVE_PRIMARIA},
                cliente TEXT,
                email TEXT,
                equipamento TEXT,
                data_retirada TEXT,
                data_devolucao TEXT,
                observacao TEXT,
                status TEXT NOT NULL DEFAULT 'Pendente'
            )
        """)

        # equipamentos iniciais (só na primeira execução)
        total = db.run("SELECT COUNT(*) AS total FROM equipamentos").um()["total"]

        if total == 0:
            for nome, categoria, status in [
                ("Notebook Dell Latitude 5420", "Notebook", "Disponível"),
                ("Projetor Epson X39", "Projetor", "Disponível"),
                ("Monitor LG 24", "Monitor", "Disponível"),
                ("Impressora Epson WF-M5899", "Impressora", "Manutenção"),
            ]:
                db.run(
                    "INSERT INTO equipamentos (nome, categoria, status) VALUES (?, ?, ?)",
                    (nome, categoria, status)
                )

        # administrador padrão (só se ainda não existir)
        admin = db.run(
            "SELECT id FROM usuarios WHERE email = ?",
            ("admin@techrent.com",)
        ).um()

        if not admin:
            db.run(
                "INSERT INTO usuarios (nome, email, telefone, cpf, senha, tipo) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    "Administrador",
                    "admin@techrent.com",
                    "(24)99999-9999",
                    "00000000000",
                    generate_password_hash("admin123"),
                    "admin"
                )
            )


iniciar_banco()


def dados_json():
    return request.get_json(silent=True) or {}


def id_valido(valor):
    return valor if isinstance(valor, int) and not isinstance(valor, bool) else None


# ==========================
# FRONT-END (arquivos do site)
# ==========================

@app.route("/")
def pagina_inicial():
    return send_from_directory(PASTA, "index.html")


@app.route("/<path:arquivo>", methods=["GET"])
def arquivos_do_site(arquivo):

    if not arquivo.endswith((".html", ".css", ".js")):
        return jsonify({"sucesso": False, "mensagem": "Não encontrado."}), 404

    return send_from_directory(PASTA, arquivo)


# ==========================
# CADASTRO
# ==========================

@app.route("/cadastro", methods=["POST"])
def cadastro():

    dados = dados_json()

    nome = dados.get("nome")
    email = dados.get("email")
    telefone = dados.get("telefone")
    cpf = dados.get("cpf")
    senha = dados.get("senha")
    tipo = dados.get("tipo")

    if not nome or not email or not telefone or not cpf or not senha or not tipo:

        return jsonify({
            "sucesso": False,
            "mensagem": "Preencha todos os campos."
        })

    with banco() as db:

        existentes = db.run(
            "SELECT email, cpf FROM usuarios WHERE email = ? OR cpf = ? ORDER BY id",
            (email, cpf)
        ).todos()

        if existentes:

            if existentes[0]["email"] == email:
                return jsonify({
                    "sucesso": False,
                    "mensagem": "E-mail já cadastrado."
                })

            return jsonify({
                "sucesso": False,
                "mensagem": "CPF já cadastrado."
            })

        db.run(
            "INSERT INTO usuarios (nome, email, telefone, cpf, senha, tipo) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (nome, email, telefone, cpf, generate_password_hash(senha), tipo)
        )

    return jsonify({
        "sucesso": True,
        "mensagem": "Usuário cadastrado com sucesso!"
    })


# ==========================
# LOGIN
# ==========================

@app.route("/login", methods=["POST"])
def login():

    dados = dados_json()

    email = dados.get("email")
    senha = dados.get("senha")

    with banco() as db:
        usuario = db.run(
            "SELECT senha, tipo FROM usuarios WHERE email = ?",
            (email,)
        ).um()

    if usuario and senha and check_password_hash(usuario["senha"], senha):

        return jsonify({
            "sucesso": True,
            "tipo": usuario["tipo"],
            "mensagem": "Login realizado com sucesso."
        })

    return jsonify({
        "sucesso": False,
        "mensagem": "Usuário ou senha inválidos."
    })


# ==========================
# MEUS DADOS
# ==========================

@app.route("/meus-dados", methods=["POST"])
def meus_dados():

    email = dados_json().get("email")

    with banco() as db:
        usuario = db.run(
            "SELECT nome, email, telefone, cpf, tipo FROM usuarios WHERE email = ?",
            (email,)
        ).um()

    if usuario:
        return jsonify(usuario)

    return jsonify({
        "sucesso": False,
        "mensagem": "Usuário não encontrado."
    })


# ==========================
# EQUIPAMENTOS
# ==========================

@app.route("/listar-equipamentos", methods=["GET"])
def listar_equipamentos():

    with banco() as db:
        equipamentos = db.run("SELECT * FROM equipamentos ORDER BY id").todos()

    return jsonify(equipamentos)


# ==========================
# CRIAR RESERVA
# ==========================

@app.route("/criar-reserva", methods=["POST"])
def criar_reserva():

    dados = dados_json()

    email = dados.get("email")

    with banco() as db:

        usuario = db.run(
            "SELECT nome FROM usuarios WHERE email = ?", (email,)
        ).um()

        db.run(
            "INSERT INTO reservas "
            "(cliente, email, equipamento, data_retirada, data_devolucao, observacao, status) "
            "VALUES (?, ?, ?, ?, ?, ?, 'Pendente')",
            (
                usuario["nome"] if usuario else "",
                email,
                dados.get("equipamento"),
                dados.get("dataRetirada"),
                dados.get("dataDevolucao"),
                dados.get("observacao")
            )
        )

    return jsonify({
        "sucesso": True,
        "mensagem": "Reserva criada com sucesso!"
    })


# ==========================
# MUDANÇA DE STATUS DA RESERVA
# ==========================

def mudar_status(id_reserva, status_reserva, status_equipamento, mensagem):

    id_reserva = id_valido(id_reserva)

    with banco() as db:

        reserva = None

        if id_reserva is not None:
            reserva = db.run(
                "SELECT equipamento FROM reservas WHERE id = ?", (id_reserva,)
            ).um()

        if reserva:

            db.run(
                "UPDATE reservas SET status = ? WHERE id = ?",
                (status_reserva, id_reserva)
            )

            if status_equipamento:
                db.run(
                    "UPDATE equipamentos SET status = ? WHERE nome = ?",
                    (status_equipamento, reserva["equipamento"])
                )

            return jsonify({
                "sucesso": True,
                "mensagem": mensagem
            })

    return jsonify({
        "sucesso": False,
        "mensagem": "Reserva não encontrada."
    })


# ==========================
# REGISTRAR RETIRADA
# ==========================

@app.route("/registrar-retirada", methods=["POST"])
def registrar_retirada():

    return mudar_status(
        dados_json().get("id"), "Retirada", "Locado",
        "Retirada registrada com sucesso!"
    )


# ==========================
# REGISTRAR DEVOLUÇÃO
# ==========================

@app.route("/registrar-devolucao", methods=["POST"])
def registrar_devolucao():

    return mudar_status(
        dados_json().get("id"), "Devolvida", "Disponível",
        "Devolução registrada com sucesso!"
    )


# ==========================
# MINHAS RESERVAS
# ==========================

@app.route("/minhas-reservas", methods=["POST"])
def minhas_reservas():

    email = dados_json().get("email")

    with banco() as db:
        resultado = db.run(
            "SELECT * FROM reservas WHERE email = ? ORDER BY id", (email,)
        ).todos()

    return jsonify(resultado)


# ==========================
# LISTAR RESERVAS
# ==========================

@app.route("/listar-reservas", methods=["GET"])
def listar_reservas():

    with banco() as db:
        reservas = db.run("SELECT * FROM reservas ORDER BY id").todos()

    return jsonify(reservas)


# ==========================
# APROVAR RESERVA
# ==========================

@app.route("/aprovar-reserva", methods=["POST"])
def aprovar_reserva():

    return mudar_status(
        dados_json().get("id"), "Aprovada", "Reservado",
        "Reserva aprovada com sucesso!"
    )


# ==========================
# RECUSAR RESERVA
# ==========================

@app.route("/recusar-reserva", methods=["POST"])
def recusar_reserva():

    return mudar_status(
        dados_json().get("id"), "Recusada", None,
        "Reserva recusada."
    )


# ==========================
# LISTAR USUÁRIOS
# ==========================

@app.route("/listar-usuarios", methods=["GET"])
def listar_usuarios():

    with banco() as db:
        usuarios = db.run(
            "SELECT nome, email, telefone, cpf, tipo FROM usuarios ORDER BY id"
        ).todos()

    return jsonify(usuarios)


# ==========================
# EXCLUIR USUÁRIOS
# ==========================

@app.route("/excluir-usuario", methods=["POST"])
def excluir_usuario():

    email = dados_json().get("email")

    with banco() as db:
        db.run("DELETE FROM usuarios WHERE email = ?", (email,))
        removido = db.n > 0

    if removido:
        return jsonify({
            "sucesso": True,
            "mensagem": "Usuário removido com sucesso!"
        })

    return jsonify({
        "sucesso": False,
        "mensagem": "Usuário não encontrado."
    })


# ==========================
# DASHBOARD ADMIN
# ==========================

@app.route("/dashboard-admin", methods=["GET"])
def dashboard_admin():

    with banco() as db:

        por_tipo = {
            linha["tipo"]: linha["total"]
            for linha in db.run(
                "SELECT tipo, COUNT(*) AS total FROM usuarios GROUP BY tipo"
            ).todos()
        }

        por_status = {
            linha["status"]: linha["total"]
            for linha in db.run(
                "SELECT status, COUNT(*) AS total FROM reservas GROUP BY status"
            ).todos()
        }

    return jsonify({
        "usuarios": sum(por_tipo.values()),
        "clientes": por_tipo.get("cliente", 0),
        "funcionarios": por_tipo.get("funcionario", 0),
        "administradores": por_tipo.get("admin", 0),
        "pendentes": por_status.get("Pendente", 0),
        "aprovadas": por_status.get("Aprovada", 0),
        "devolvidas": por_status.get("Devolvida", 0)
    })


# ==========================
# INICIAR SERVIDOR (uso local)
# ==========================
# Em produção o servidor é o gunicorn, que não executa este bloco.

if __name__ == "__main__":
    app.run(debug=True)
