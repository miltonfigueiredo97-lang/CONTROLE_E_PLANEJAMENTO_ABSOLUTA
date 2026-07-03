# Controle e Planejamento de Obras — Absoluta

Plataforma web profissional para Planejamento e Controle de Obras.

## Tecnologias

- **Frontend:** HTML, CSS, JavaScript (vanilla, modular)
- **Backend:** Firebase (Authentication, Firestore, Storage)
- **Hospedagem:** GitHub + Vercel
- **Apoio:** Google Sheets (importação/exportação)

## Como colocar no ar

### 1. Criar projeto no Firebase
1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um novo projeto
3. Ative **Authentication** → Email/Senha
4. Crie um banco **Firestore Database** (modo teste para início)
5. Ative **Storage** (opcional por enquanto)

### 2. Configurar credenciais
1. No Firebase Console → Configurações do Projeto → Seus apps → Web
2. Copie o objeto `firebaseConfig`
3. Cole em `js/firebase-config.js`

### 3. Publicar na Vercel
1. Suba o projeto para um repositório GitHub
2. Acesse [vercel.com](https://vercel.com) e importe o repositório
3. Deploy automático!

### 4. Primeiro acesso
1. Acesse a URL da Vercel
2. Faça login (o primeiro usuário vira Admin automaticamente)
3. Crie sua primeira obra
4. Comece a usar!

### Regras do Firestore (modo desenvolvimento)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> **Atenção:** Essas regras permitem qualquer usuário autenticado ler/escrever. Para produção, implemente regras mais restritivas.

## Estrutura de arquivos

```
├── index.html                  # Redirect para login
├── login.html                  # Autenticação
├── dashboard.html              # Dashboard principal
├── obras.html                  # Gestão de obras (funcional)
├── configuracao-obra.html      # Config da obra (funcional)
├── levantamento.html           # Hub de levantamentos
├── levantamento-fachada.html   # Calculadora de Fachada (funcional)
├── planejamento.html           # Stub
├── controle.html               # Stub
├── (demais módulos...)         # Stubs preparados
├── css/
│   ├── base.css                # Design system
│   ├── layout.css              # Layout sidebar+header
│   ├── tabelas.css             # Estilos de tabela
│   ├── modulos.css             # CSS por módulo
│   └── dashboard.css           # Dashboard
├── js/
│   ├── firebase-config.js      # ⚠️ PREENCHER COM SUAS CREDENCIAIS
│   ├── auth.js                 # Autenticação
│   ├── database.js             # Camada CRUD Firestore
│   ├── router.js               # Navegação e obra selecionada
│   ├── permissions.js          # Controle de acesso
│   ├── audit.js                # Auditoria
│   ├── utils.js                # Utilitários compartilhados
│   ├── obras.js                # Módulo Obras
│   ├── configuracao-obra.js    # Módulo Config
│   ├── levantamento.js         # Hub Levantamentos
│   ├── levantamento-fachada.js # Calculadora Fachada
│   └── (stubs demais módulos)
└── docs/                       # Documentação do projeto
```

## Módulos implementados (V1)

| Módulo | Status |
|--------|--------|
| Login / Auth | ✅ Funcional |
| Obras (CRUD) | ✅ Funcional |
| Configuração da Obra | ✅ Funcional |
| Levantamento de Fachada | ✅ Funcional |
| Planejamento | 🚧 Stub |
| Controle | 🚧 Stub |
| Demais módulos | 🚧 Stub |

## Arquitetura

- **Entidade central:** TAREFA (todos os módulos compartilham o mesmo UID)
- **Dados:** Firebase Firestore com subcoleções por obra
- **Modular:** cada módulo = 1 arquivo JS + 1 arquivo HTML
- **Auditoria:** todas as ações são registradas com UID do usuário
