// No site publicado o Flask serve as páginas, então a API fica na mesma origem.
// Localmente (arquivo aberto direto ou Live Server) usa o Flask em 127.0.0.1:5000.
const EM_PRODUCAO = !["localhost", "127.0.0.1", ""].includes(location.hostname);
const API = EM_PRODUCAO ? "" : "http://127.0.0.1:5000";

/* ===========================
   APOIO VISUAL (apenas apresentação)
=========================== */

const CORES_STATUS = {
    "Disponível": "ok", "Aprovada": "ok",
    "Pendente": "warn", "Manutenção": "bad", "Recusada": "bad",
    "Reservado": "info", "Devolvida": "info",
    "Locado": "violet", "Retirada": "violet"
};

function badge(status) {
    return `<span class="badge ${CORES_STATUS[status] || ""}">${status}</span>`;
}

function perfil(tipo) {
    const nomes = { cliente: "Cliente", funcionario: "Funcionário", admin: "Administrador" };
    return `<span class="badge info">${nomes[tipo] || tipo}</span>`;
}

function vazio() {
    return `<div class="vazio">Nenhum registro encontrado.</div>`;
}


/* ===========================
   CADASTRO
=========================== */

function cadastrar() {

    const nome = document.getElementById("nome-cadastro").value;
    const email = document.getElementById("email-cadastro").value;
    const telefone = document.getElementById("telefone-cadastro").value;
    const cpf = document.getElementById("cpf-cadastro").value;
    const senha = document.getElementById("senha-cadastro").value;
    const confirmarSenha = document.getElementById("confirmar-senha-cadastro").value;
    const tipo = document.getElementById("tipo-usuario").value;

    if (senha !== confirmarSenha) {
        abrirModal("As senhas não coincidem.");
        return;
    }

    fetch(`${API}/cadastro`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            nome,
            email,
            telefone,
            cpf,
            senha,
            tipo
        })
    })
    .then(resposta => resposta.json())
    .then(dados => {

        if (!dados.sucesso) {
            abrirModal(dados.mensagem);
            return;
        }

        abrirModal("Cadastro realizado com sucesso!");

        setTimeout(() => {
            window.location.href = "pagelogin.html";
        }, 1500);
    });
}

/* ===========================
   LOGIN
=========================== */

function login() {

    const email = document.getElementById("email-login").value;
    const senha = document.getElementById("senha-login").value;

    fetch(`${API}/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            senha
        })
    })
    .then(resposta => resposta.json())
    .then(dados => {

        if (!dados.sucesso) {
            abrirModal(dados.mensagem);
            return;
        }

        localStorage.setItem("usuarioLogado", email);
        localStorage.setItem("tipoUsuario", dados.tipo);

        if (dados.tipo === "cliente") {
            window.location.href = "pagecliente.html";
        }

        if (dados.tipo === "funcionario") {
            window.location.href = "pagefuncionario.html";
        }

        if (dados.tipo === "admin") {
            window.location.href = "pageadmin.html";
        }
    });
}

/* ===========================
   DADOS DA CONTA
=========================== */

function carregarDados() {

    const email = localStorage.getItem("usuarioLogado");

    if (!email) return;

    fetch(`${API}/meus-dados`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email })
    })
    .then(resposta => resposta.json())
    .then(usuario => {

        const dadosConta = document.getElementById("dados-conta");

        if (!dadosConta) return;

        dadosConta.innerHTML = `
            <p><strong>Nome</strong><br>${usuario.nome}</p>
            <p><strong>E-mail</strong><br>${usuario.email}</p>
            <p><strong>Telefone</strong><br>${usuario.telefone}</p>
            <p><strong>CPF</strong><br>${usuario.cpf}</p>
            <p><strong>Perfil</strong>${perfil(usuario.tipo)}</p>
        `;
    });
}

/* ===========================
   EQUIPAMENTOS
=========================== */

function carregarEquipamentos() {

    const lista = document.getElementById("lista-equipamentos");

    if (!lista) return;

    fetch(`${API}/listar-equipamentos`)
    .then(resposta => resposta.json())
    .then(equipamentos => {

        lista.innerHTML = equipamentos.map(equipamento => {

            return `
                <div class="card-tecnico">

                <h3>${equipamento.nome}</h3>

                <hr>

                <strong>Categoria</strong>
                <p>${equipamento.categoria}</p>
            
                <strong>Status</strong>
                <p>${badge(equipamento.status)}</p>
            
                ${
                    equipamento.status === "Disponível"
                    ? `
                        <button onclick="reservarEquipamento('${equipamento.nome}')">
                            Reservar
                        </button>
                    `
                    : `
                        <button class="botao-indisponivel" disabled>
                            Indisponível
                        </button>
                    `
                }
                </div>
            `;
        }).join("") || vazio();
    });
}

/* ===========================
   RESERVA
=========================== */

function CriarChamado() {

    const email = localStorage.getItem("usuarioLogado");

    const titulo = document.getElementById("titulo-chamado").value;
    const equipamento = document.getElementById("categoria-chamado").value;
    const observacao = document.getElementById("descricao-chamado").value;
    const dataRetirada = document.getElementById("data-retirada").value;
    const dataDevolucao = document.getElementById("data-devolucao").value;

    if (
        equipamento === "" &&
        titulo === ""
    ) {
        abrirModal("Selecione um equipamento.");
        return;
    }

    if (dataRetirada === "") {
        abrirModal("Informe a data de retirada.");
        return;
    }

    if (dataDevolucao === "") {
        abrirModal("Informe a data de devolução.");
        return;
    }

    if (observacao.trim() === "") {
        abrirModal("Informe uma observação para a reserva.");
        return;
    }

    if (dataDevolucao < dataRetirada) {
        abrirModal("A data de devolução deve ser maior que a data de retirada.");
        return;
    }

    fetch(`${API}/criar-reserva`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email,
            titulo,
            equipamento: titulo || equipamento,
            observacao,
            dataRetirada,
            dataDevolucao
        })
    })
    .then(resposta => resposta.json())
    .then(dados => {

        abrirModal(dados.mensagem);

        fecharModalChamado();

        document.getElementById("titulo-chamado").value = "";
        document.getElementById("categoria-chamado").value = "";
        document.getElementById("descricao-chamado").value = "";
        document.getElementById("data-retirada").value = "";
        document.getElementById("data-devolucao").value = "";
    });
    
}

/* ===========================
   MINHAS RESERVAS
=========================== */

function minhasReservas() {

    const email = localStorage.getItem("usuarioLogado");

    const lista = document.getElementById("lista-minhas-reservas");

    if (!lista) return;

    fetch(`${API}/minhas-reservas`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email
        })
    })
    .then(resposta => resposta.json())
    .then(reservas => {

        lista.innerHTML = reservas.map(reserva => {

            return `
                <div class="card-chamado">

                    <h3>${reserva.equipamento}</h3>

                    <hr>

                    <p>
                        <strong>Status da Reserva</strong><br>
                        ${badge(reserva.status)}
                    </p>

                    <p>
                        <strong>Data de Retirada</strong><br>
                        ${reserva.data_retirada || "Não informada"}
                    </p>

                    <p>
                        <strong>Data de Devolução</strong><br>
                        ${reserva.data_devolucao || "Não informada"}
                    </p>

                </div>
            `;

        }).join("") || vazio();
    });
}

/* ===========================
   ADMIN
=========================== */

function listarReservas() {

    const lista = document.getElementById("lista-reservas");

    if (!lista) return;

    fetch(`${API}/listar-reservas`)
    .then(resposta => resposta.json())
    .then(reservas => {

        lista.innerHTML = reservas.map(reserva => {

            return `
                <div class="card-chamado">

                    <h3>${reserva.equipamento}</h3>

                    <hr>

                    <p>
                        <strong>Cliente</strong><br>
                        ${reserva.cliente}
                    </p>

                    <p>
                        <strong>Status</strong><br>
                        ${badge(reserva.status)}
                    </p>

                    <p>
                        <strong>Data de Retirada</strong><br>
                        ${reserva.data_retirada || "Não informada"}
                    </p>

                    <p>
                        <strong>Data de Devolução</strong><br>
                        ${reserva.data_devolucao || "Não informada"}
                    </p>

                    <p>
                        <strong>Observações</strong><br>
                        ${reserva.observacao || "Nenhuma observação"}
                    </p>

                </div>
            `; 

        }).join("") || vazio();
    });
}

function aprovarReserva(id) {

    fetch(`${API}/aprovar-reserva`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ id })
    })
    .then(resposta => resposta.json())
    .then(dados => {
        abrirModal(dados.mensagem);
        atualizarTudo();
    });
}

function recusarReserva(id) {

    fetch(`${API}/recusar-reserva`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ id })
    })
    .then(resposta => resposta.json())
    .then(dados => {
        abrirModal(dados.mensagem);
        atualizarTudo();
    });
}

function registrarRetirada(id) {

    fetch(`${API}/registrar-retirada`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            id
        })

    })
    .then(resposta => resposta.json())
    .then(dados => {

        abrirModal(dados.mensagem);

        atualizarTudo();

    });
}

function registrarDevolucao(id) {

    fetch(`${API}/registrar-devolucao`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            id
        })

    })
    .then(resposta => resposta.json())
    .then(dados => {

        abrirModal(dados.mensagem);

        atualizarTudo();

    });
}

function listarReservasDashboard() {

    const lista = document.getElementById("lista-reservas-admin");

    if (!lista) return;

    fetch(`${API}/listar-reservas`)
    .then(resposta => resposta.json())
    .then(reservas => {

        lista.innerHTML = reservas.map(reserva => {

            return `
                <div class="card-tecnico">

                    <h3>${reserva.equipamento}</h3>

                    <hr>

                    <strong>Cliente</strong>
                    <p>${reserva.cliente}</p>

                    <strong>Status</strong>
                    <p>${badge(reserva.status)}</p>

                    <button onclick="window.location.href='gerenciar-reservas-funcionario.html'">
                        Ver detalhes
                    </button>
                </div>

                
            `;

        }).join("") || vazio();

    });
}

function listarReservasFuncionario() {

    const lista =
        document.getElementById("lista-reservas-funcionario");

    if (!lista) return;

    fetch(`${API}/listar-reservas`)
    .then(resposta => resposta.json())
    .then(reservas => {

        lista.innerHTML = reservas.map(reserva => {

            return `
                <div class="card-chamado">

                    <h3>${reserva.equipamento}</h3>

                    <hr>

                    <p>
                        <strong>Cliente</strong><br>
                        ${reserva.cliente}
                    </p>

                    <p>
                        <strong>Status</strong><br>
                        ${badge(reserva.status)}
                    </p>

                    <p>
                        <strong>Data de Retirada</strong><br>
                        ${reserva.data_retirada}
                    </p>

                    <p>
                        <strong>Data de Devolução</strong><br>
                        ${reserva.data_devolucao}
                    </p>

                    <p>
                        <strong>Observações</strong><br>
                        ${reserva.observacao}
                    </p>

                    ${reserva.status === "Pendente" ? `

                        <button onclick="aprovarReserva(${reserva.id})">
                            Aprovar
                        </button>

                        <button onclick="recusarReserva(${reserva.id})">
                            Recusar
                        </button>

                    ` : ""}

                    ${reserva.status === "Aprovada" ? `

                        <button onclick="registrarRetirada(${reserva.id})">
                            Registrar Retirada
                        </button>

                    ` : ""}

                    ${reserva.status === "Retirada" ? `

                        <button onclick="registrarDevolucao(${reserva.id})">
                            Registrar Devolução
                        </button>

                    ` : ""}

                </div>
            `;

        }).join("") || vazio();

    });
}

function listarUsuarios() {

    const lista =
        document.getElementById("lista-usuarios");

    if (!lista) return;

    fetch(`${API}/listar-usuarios`)
    .then(resposta => resposta.json())
    .then(usuarios => {

        lista.innerHTML =
            usuarios.map(usuario => {

                return `
                    <div class="card-chamado">

                        <h3>${usuario.nome}</h3>

                        <hr>

                        <p>
                            <strong>E-mail</strong><br>
                            ${usuario.email}
                        </p>

                        <p>
                            <strong>Telefone</strong><br>
                            ${usuario.telefone}
                        </p>

                        <p>
                            <strong>CPF</strong><br>
                            ${usuario.cpf}
                        </p>

                        <p>
                            <strong>Perfil</strong><br>
                            ${perfil(usuario.tipo)}
                        </p>

                        ${usuario.email !== "admin@techrent.com" ? `

                            <button
                                onclick="excluirUsuario('${usuario.email}')">

                                Excluir
                            </button>

                        ` : `

                            <button
                                class="botao-indisponivel"
                                disabled>
                                Administrador Principal
                            </button>

                        `}

                    </div>
                `;

            }).join("") || vazio();

    });
}

function excluirUsuario(email) {

    if (!confirm("Deseja realmente excluir este usuário?")) {
        return;
    }

    fetch(`${API}/excluir-usuario`, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            email
        })

    })
    .then(resposta => resposta.json())
    .then(dados => {

        abrirModal(dados.mensagem);

        listarUsuarios();

    });
}

function carregarDashboardAdmin() {

    const usuarios =
        document.getElementById("total-usuarios");

    if (!usuarios) return;

    fetch(`${API}/dashboard-admin`)
    .then(resposta => resposta.json())
    .then(dados => {

        document.getElementById(
            "total-usuarios"
        ).innerText = dados.usuarios;

        document.getElementById(
            "total-clientes"
        ).innerText = dados.clientes;

        document.getElementById(
            "total-funcionarios"
        ).innerText = dados.funcionarios;

    });
}

/* ===========================
   RESUMOS (contadores por status)
=========================== */

function preencherResumo(reservas) {

    const c = { Pendente: 0, Aprovada: 0, Retirada: 0, Devolvida: 0, Recusada: 0 };

    reservas.forEach(r => {
        if (c[r.status] !== undefined) c[r.status]++;
    });

    const set = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.innerText = valor;
    };

    // cliente e funcionário
    set("resumo-pendentes", c.Pendente);
    set("resumo-aprovadas", c.Aprovada);
    set("resumo-retiradas", c.Retirada);
    set("resumo-devolvidas", c.Devolvida);
    set("resumo-recusadas", c.Recusada);

    // admin (ids que já existem)
    set("total-pendentes", c.Pendente);
    set("total-aprovadas", c.Aprovada);
    set("total-devolvidas", c.Devolvida);
}

function carregarResumo() {

    const temResumo =
        document.querySelector("[id^='resumo-']") ||
        document.getElementById("total-pendentes");

    if (!temResumo) return;

    const email = localStorage.getItem("usuarioLogado");
    const tipo = localStorage.getItem("tipoUsuario");

    const pedido = tipo === "cliente"
        ? fetch(`${API}/minhas-reservas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        })
        : fetch(`${API}/listar-reservas`);

    pedido
        .then(resposta => resposta.json())
        .then(preencherResumo);
}

function atualizarTudo() {
    listarReservas();
    listarReservasFuncionario();
    listarReservasDashboard();
    carregarResumo();
}

/* ===========================
   MODAIS
=========================== */

function abrirModal(mensagem) {

    document.getElementById("mensagem-modal").innerText = mensagem;
    document.getElementById("modal").style.opacity = "1";
    document.getElementById("modal").style.visibility = "visible";
}

function fecharModal() {

    document.getElementById("modal").style.opacity = "0";
    document.getElementById("modal").style.visibility = "hidden";
}

function abrirModalChamado() {

    document.getElementById("modal-chamado").style.opacity = "1";
    document.getElementById("modal-chamado").style.visibility = "visible";

    document.getElementById("container-categoria").style.display =
        "block";
}

function fecharModalChamado() {

    document.getElementById("modal-chamado").style.opacity = "0";
    document.getElementById("modal-chamado").style.visibility = "hidden";
}

function reservarEquipamento(nomeEquipamento) {

    abrirModalChamado();

    document.getElementById("titulo-chamado").value =
        nomeEquipamento;

    document.getElementById("container-categoria").style.display =
        "none";
}

/* ===========================
   LOGOUT
=========================== */

function sair() {

    localStorage.removeItem("usuarioLogado");
    localStorage.removeItem("tipoUsuario");

    window.location.href = "pagelogin.html";
}

/* ===========================
   LOAD
=========================== */

window.addEventListener("load", carregarDados);
window.addEventListener("load", carregarEquipamentos);
window.addEventListener("load", minhasReservas);
window.addEventListener("load", listarReservas);
window.addEventListener("load", listarReservasDashboard);
window.addEventListener("load", listarReservasFuncionario);
window.addEventListener("load", listarUsuarios);
window.addEventListener("load", carregarDashboardAdmin);
window.addEventListener("load", carregarResumo);