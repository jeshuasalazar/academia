const PLANES = [
  {
    id: 'explorador',
    tag: 'EXPLORADOR',
    nombre: 'Explorador',
    precio: '$0 MXN',
    lema: 'Conoce la metodología antes de invertir.',
    features: [
      'Cursos introductorios on-demand',
      'Boletín semanal con casos de uso',
      'Top 10 prompts de productividad ejecutiva',
      'Comunidad pública aiLearning'
    ]
  },
  {
    id: 'esencial',
    tag: 'ESENCIAL',
    nombre: 'Esencial',
    precio: '$449 MXN / mes',
    lema: 'IA práctica en tu operación diaria.',
    features: [
      'Sesiones y cursos en vivo ilimitados',
      'Grabaciones por 7 días',
      'Materiales + biblioteca de prompts base',
      'Comunidad privada aiLearning'
    ]
  },
  {
    id: 'pro',
    tag: 'AI-NATIVE PRO',
    nombre: 'AI-Native Pro',
    precio: '$949 MXN / mes',
    lema: 'Diagnóstico, automatización y dominio técnico.',
    destacado: true,
    features: [
      'Todo lo de Esencial',
      'Videoteca completa',
      'Flujos, automatizaciones y prompts avanzados',
      'Q&A privado y sesiones con instructores',
      'Certificación digital por ruta completada'
    ]
  },
  {
    id: 'corporativo',
    tag: 'CORPORATIVO',
    nombre: 'Corporativo',
    precio: 'A la medida',
    lema: 'Implementación privada para equipos y empresas.',
    features: [
      'Diagnóstico estratégico privado',
      'Capacitación y onboarding privado',
      'Gobierno, métricas y soporte prioritario',
      'Ejecutivo de cuenta'
    ]
  }
];

module.exports = {
  planes: PLANES,

  empresas: [
    { id: 'emp-ail', nombre: 'aiLearning', tipo: 'propietaria', color: '#2D88E8', contacto: 'hola@ailearning.mx' },
    { id: 'emp-conta', nombre: 'ContaFlow Capacitación', tipo: 'externa', color: '#22A06B', contacto: 'cursos@contaflow.mx' },
    { id: 'emp-dev', nombre: 'DevCamp MX', tipo: 'externa', color: '#8B5CF6', contacto: 'hola@devcamp.mx' }
  ],

  profesores: [
    {
      id: 'prof-1',
      nombre: 'CP Mariana Gutiérrez',
      iniciales: 'MG',
      empresaId: 'emp-conta',
      bio: 'Contadora pública, 12 años automatizando despachos contables',
      avatarGrad: 'linear-gradient(135deg,#34C98E,#1F7A55)'
    },
    {
      id: 'prof-2',
      nombre: 'Ing. Diego Ramos',
      iniciales: 'DR',
      empresaId: 'emp-dev',
      bio: 'Ingeniero de software, ex-startup fintech, experiencia en full-stack',
      avatarGrad: 'linear-gradient(135deg,#A78BFA,#6D28D9)'
    },
    {
      id: 'prof-3',
      nombre: 'Lic. Sofía Herrera',
      iniciales: 'SH',
      empresaId: 'emp-ail',
      bio: 'Diseñadora y consultora de marca digital, especialista en UX/UI',
      avatarGrad: 'linear-gradient(135deg,#5FA8F5,#1A5FB4)'
    }
  ],

  alumnos: [
    { id: 'al-1', nombre: 'Jesús Salazar', iniciales: 'JS', empresaId: 'emp-ail', tipo: 'interno', plan: 'pro', xp: 1240, racha: 6 },
    { id: 'al-2', nombre: 'Ana Torres', iniciales: 'AT', empresaId: 'emp-conta', tipo: 'externo', plan: 'corporativo', xp: 430, racha: 2 },
    { id: 'al-3', nombre: 'Luis Peña', iniciales: 'LP', empresaId: 'emp-dev', tipo: 'externo', plan: 'corporativo', xp: 820, racha: 4 },
    { id: 'al-4', nombre: 'Karla Medina', iniciales: 'KM', empresaId: 'emp-ail', tipo: 'interno', plan: 'explorador', xp: 120, racha: 1 },
    { id: 'al-5', nombre: 'Roberto Díaz', iniciales: 'RD', empresaId: 'emp-ail', tipo: 'interno', plan: 'esencial', xp: 560, racha: 3 }
  ],

  cursos: [
    {
      id: 'c-conta',
      slug: 'contabilidad-claude',
      titulo: 'Simplifica tus procesos contables con Claude: de 30 días a unas horas',
      profesorId: 'prof-1',
      empresaId: 'emp-conta',
      nivel: 'Intermedio',
      dur: '6 h 20 m',
      cover: 'linear-gradient(135deg,#0E3B2E,#22A06B)',
      desc: 'Aprende a automatizar procesos contables con Claude. Desde conciliaciones bancarias hasta pólizas contables, reduce tiempos de hasta 30 días a unas pocas horas. Diseñado para contadores públicos y profesionistas de despachos.',
      modulos: [
        {
          id: 'm-conta-1',
          titulo: 'Fundamentos: Claude para contadores',
          sesiones: ['s-conta-1', 's-conta-2', 's-conta-3']
        },
        {
          id: 'm-conta-2',
          titulo: 'Automatización de procesos clave',
          sesiones: ['s-conta-4', 's-conta-5', 's-conta-6']
        },
        {
          id: 'm-conta-3',
          titulo: 'Cierre mensual y reportes',
          sesiones: ['s-conta-7', 's-conta-8', 's-conta-9']
        }
      ],
      sesiones: [
        {
          id: 's-conta-1',
          modulo: 'm-conta-1',
          titulo: 'Conciliaciones bancarias con Claude en 20 minutos',
          tipo: 'grabada',
          dur: 18,
          video: { proveedor: 'youtube', id: 'aircAruvnKk' },
          materiales: [
            { id: 'mat-conta-1', nombre: 'Plantilla conciliación.xlsx', tipo: 'xlsx', size: '48 KB', url: '#' },
            { id: 'mat-conta-2', nombre: 'Prompt: Conciliación bancaria.txt', tipo: 'prompt.txt', size: '2 KB', url: '#' }
          ],
          descripcion: 'Descubre cómo Claude automatiza la conciliación bancaria. Importa extractos bancarios, carga pólizas y obtén una conciliación lista en minutos. Incluye template Excel lista para usar.'
        },
        {
          id: 's-conta-2',
          modulo: 'm-conta-1',
          titulo: 'Del PDF del SAT a póliza contable automática',
          tipo: 'grabada',
          dur: 22,
          video: { proveedor: 'bunny', libraryId: '239255', videoId: 'd6c3e6b2-8b0a-4a2e-9e0f-demo0000001' },
          materiales: [
            { id: 'mat-conta-3', nombre: 'XML SAT a póliza (macro).xlsx', tipo: 'xlsx', size: '156 KB', url: '#' },
            { id: 'mat-conta-4', nombre: 'Guía SAT parsing.pdf', tipo: 'pdf', size: '890 KB', url: '#' }
          ],
          descripcion: 'Transforma archivos XML del SAT en pólizas contables listas para importar a tu software. Claude extrae conceptos, montos, clientes y proveedores automáticamente.'
        },
        {
          id: 's-conta-3',
          modulo: 'm-conta-1',
          titulo: 'Casos prácticos: CFDI, factura electrónica y fiscalización',
          tipo: 'grabada',
          dur: 20,
          video: { proveedor: 'youtube', id: 'zjkBMFhNj_g' },
          materiales: [
            { id: 'mat-conta-5', nombre: 'Casos reales contabilidad.pdf', tipo: 'pdf', size: '2.1 MB', url: '#' }
          ],
          descripcion: 'Resolvemos casos reales de despachos contables: reconocimiento de ingresos, depreciación con IA, validación de CFDIs y preparación para auditoría.'
        },
        {
          id: 's-conta-4',
          modulo: 'm-conta-2',
          titulo: 'Automatización de facturas y pagos',
          tipo: 'grabada',
          dur: 16,
          video: { proveedor: 'youtube', id: 'kCc8FmEb1nY' },
          materiales: [
            { id: 'mat-conta-6', nombre: 'Flujo facturas (Zapier + Claude).pdf', tipo: 'pdf', size: '420 KB', url: '#' }
          ],
          descripcion: 'Automatiza la captura, clasificación y vencimiento de facturas. Claude integrado con Zapier genera automáticamente pólizas de pago.'
        },
        {
          id: 's-conta-5',
          modulo: 'm-conta-2',
          titulo: 'Análisis de flujo de caja predictivo',
          tipo: 'grabada',
          dur: 19,
          video: { proveedor: 'youtube', id: 'l-9ALe3U-Fg' },
          materiales: [
            { id: 'mat-conta-7', nombre: 'Template flujo caja 12m.xlsx', tipo: 'xlsx', size: '204 KB', url: '#' }
          ],
          descripcion: 'Usa Claude para proyectar flujos de caja basado en históricos. Identifica brechas de efectivo 2-3 meses antes.'
        },
        {
          id: 's-conta-6',
          modulo: 'm-conta-2',
          titulo: 'Impuestos municipales y estatales automáticos',
          tipo: 'grabada',
          dur: 14,
          video: { proveedor: 'youtube', id: 'wjZofJX0v4M' },
          materiales: [
            { id: 'mat-conta-8', nombre: 'Tablas impuestos MX 2026.xlsx', tipo: 'xlsx', size: '312 KB', url: '#' }
          ],
          descripcion: 'Cálculo automático de ISR, IVA, tenencia, contribuciones municipales con Claude basado en normativa 2026.'
        },
        {
          id: 's-conta-7',
          modulo: 'm-conta-3',
          titulo: 'Cierre mensual asistido por IA en 4 horas',
          tipo: 'grabada',
          dur: 25,
          video: { proveedor: 'youtube', id: 'LPZh9BOjkQs' },
          materiales: [
            { id: 'mat-conta-9', nombre: 'Checklist cierre Claude.pdf', tipo: 'pdf', size: '156 KB', url: '#' },
            { id: 'mat-conta-10', nombre: 'Scripts cierre (Python).zip', tipo: 'zip', size: '45 KB', url: '#' }
          ],
          descripcion: 'Automatiza revisiones contables, genera diarios de ajuste, valida saldos y prepara estados financieros. Reduce 2 días de trabajo a 4 horas.'
        },
        {
          id: 's-conta-8',
          modulo: 'm-conta-3',
          titulo: 'Estados financieros: Balance, P&L y flujos en minutos',
          tipo: 'grabada',
          dur: 17,
          video: { proveedor: 'youtube', id: 'aircAruvnKk' },
          materiales: [
            { id: 'mat-conta-11', nombre: 'Template EEFF.xlsx', tipo: 'xlsx', size: '268 KB', url: '#' }
          ],
          descripcion: 'Claude genera automáticamente balance, estado de resultados, flujo de caja y análisis de ratios listos para presentar a bancos/inversionistas.'
        },
        {
          id: 's-conta-9',
          modulo: 'm-conta-3',
          titulo: 'Auditoría interna y cumplimiento normativo',
          tipo: 'grabada',
          dur: 21,
          video: { proveedor: 'youtube', id: 'zjkBMFhNj_g' },
          materiales: [
            { id: 'mat-conta-12', nombre: 'Matriz de auditoría.xlsx', tipo: 'xlsx', size: '189 KB', url: '#' }
          ],
          descripcion: 'Prepara tu despacho para auditoría externa. Claude valida cumplimiento fiscal, documenta hallazgos y genera reportes de control interno.'
        }
      ]
    },

    {
      id: 'c-app',
      slug: 'construye-app-ia',
      titulo: 'Construye tu primera aplicación con IA',
      profesorId: 'prof-2',
      empresaId: 'emp-dev',
      nivel: 'Principiante',
      dur: '5 h 45 m',
      cover: 'linear-gradient(135deg,#5D2C8B,#A78BFA)',
      desc: 'De cero a una aplicación full-stack con Claude AI. Aprende a usar Claude API, integra modelos de lenguaje y crea features inteligentes. Incluye front, backend y deployment.',
      modulos: [
        {
          id: 'm-app-1',
          titulo: 'Bases: LLMs y Claude API',
          sesiones: ['s-app-1', 's-app-2', 's-app-3']
        },
        {
          id: 'm-app-2',
          titulo: 'Backend e integración',
          sesiones: ['s-app-4', 's-app-5']
        },
        {
          id: 'm-app-3',
          titulo: 'Frontend y deployment',
          sesiones: ['s-app-6', 's-app-7', 's-app-8']
        }
      ],
      sesiones: [
        {
          id: 's-app-1',
          modulo: 'm-app-1',
          titulo: 'Intro a LLMs: cómo piensan (y no piensan) los modelos',
          tipo: 'grabada',
          dur: 16,
          video: { proveedor: 'youtube', id: 'aircAruvnKk' },
          materiales: [
            { id: 'mat-app-1', nombre: 'Diapositivas LLM.pdf', tipo: 'pdf', size: '3.2 MB', url: '#' }
          ],
          descripcion: 'Entiende los transformers, tokens, embeddings y por qué los LLMs son poderosos pero limitados. Conceptos clave antes de programar.'
        },
        {
          id: 's-app-2',
          modulo: 'm-app-1',
          titulo: 'Tu primer prompt a Claude (y por qué falla)',
          tipo: 'grabada',
          dur: 12,
          video: { proveedor: 'youtube', id: 'zjkBMFhNj_g' },
          materiales: [
            { id: 'mat-app-2', nombre: 'Prompt engineering checklist.txt', tipo: 'prompt.txt', size: '1.8 KB', url: '#' },
            { id: 'mat-app-3', nombre: 'Playground Claude API.html', tipo: 'html', size: '45 KB', url: '#' }
          ],
          descripcion: 'Construimos el primer prompt. Errores comunes: ambigüedad, contexto insuficiente, formato de respuesta poco claro. Los corregimos en vivo.'
        },
        {
          id: 's-app-3',
          modulo: 'm-app-1',
          titulo: 'Tokens, temperatura y parámetros de Claude',
          tipo: 'grabada',
          dur: 14,
          video: { proveedor: 'bunny', libraryId: '239255', videoId: 'd6c3e6b2-8b0a-4a2e-9e0f-demo0000002' },
          materiales: [
            { id: 'mat-app-4', nombre: 'Token counter (Python).py', tipo: 'py', size: '2.1 KB', url: '#' }
          ],
          descripcion: 'Control fino de salidas: temperatura para creatividad vs. consistencia, max_tokens para presupuesto, top_p y top_k explicados con ejemplos.'
        },
        {
          id: 's-app-4',
          modulo: 'm-app-2',
          titulo: 'Backend Node.js + Claude API',
          tipo: 'grabada',
          dur: 20,
          video: { proveedor: 'youtube', id: 'kCc8FmEb1nY' },
          materiales: [
            { id: 'mat-app-5', nombre: 'servidor-chat.js', tipo: 'js', size: '4.2 KB', url: '#' },
            { id: 'mat-app-6', nombre: '.env.example', tipo: 'txt', size: '150 B', url: '#' }
          ],
          descripcion: 'Configura Express, autentica con tu API key de Claude, construye endpoint para chat. Manejo de errores y timeouts.'
        },
        {
          id: 's-app-5',
          modulo: 'm-app-2',
          titulo: 'Persistencia, caché y memory management',
          tipo: 'grabada',
          dur: 18,
          video: { proveedor: 'youtube', id: 'l-9ALe3U-Fg' },
          materiales: [
            { id: 'mat-app-7', nombre: 'SQLite setup.sql', tipo: 'sql', size: '890 B', url: '#' }
          ],
          descripcion: 'Almacena conversaciones en DB. Context window finito: estrategias de memory. RAG básico: embeddings y similitud coseno.'
        },
        {
          id: 's-app-6',
          modulo: 'm-app-3',
          titulo: 'Frontend React con streaming',
          tipo: 'grabada',
          dur: 19,
          video: { proveedor: 'youtube', id: 'wjZofJX0v4M' },
          materiales: [
            { id: 'mat-app-8', nombre: 'ChatComponent.jsx', tipo: 'jsx', size: '3.8 KB', url: '#' }
          ],
          descripcion: 'Interfaz de chat que consume tu API. Streaming de respuestas para UX fluidez. Indicadores de carga, errores, reintentos.'
        },
        {
          id: 's-app-7',
          modulo: 'm-app-3',
          titulo: 'Testing y debugging',
          tipo: 'grabada',
          dur: 15,
          video: { proveedor: 'youtube', id: 'LPZh9BOjkQs' },
          materiales: [
            { id: 'mat-app-9', nombre: 'test-suite.js', tipo: 'js', size: '2.5 KB', url: '#' }
          ],
          descripcion: 'Jest para unitarios. Fixture de prompts conocidos. Cómo debuggear cuando Claude da respuestas inesperadas.'
        },
        {
          id: 's-app-8',
          modulo: 'm-app-3',
          titulo: 'Deploy: Railway y Vercel',
          tipo: 'grabada',
          dur: 13,
          video: { proveedor: 'youtube', id: 'aircAruvnKk' },
          materiales: [
            { id: 'mat-app-10', nombre: 'railway.toml', tipo: 'toml', size: '380 B', url: '#' },
            { id: 'mat-app-11', nombre: 'vercel.json', tipo: 'json', size: '420 B', url: '#' }
          ],
          descripcion: 'Despliega backend en Railway, frontend en Vercel. Variables de entorno, secrets, CI/CD mínimo. Tu app en vivo en 15 minutos.'
        }
      ]
    },

    {
      id: 'c-web',
      slug: 'web-disruptiva',
      titulo: 'Construye tu página web disruptiva',
      profesorId: 'prof-3',
      empresaId: 'emp-ail',
      nivel: 'Principiante',
      dur: '4 h 15 m',
      cover: 'linear-gradient(135deg,#004B97,#5FA8F5)',
      desc: 'Diseña y construye una landing page moderna con HTML, CSS y JavaScript. Desde wireframe hasta deployment. Aprende UX/UI principles y cómo impresionar con una web estática rápida.',
      modulos: [
        {
          id: 'm-web-1',
          titulo: 'Diseño y wireframing',
          sesiones: ['s-web-1', 's-web-2']
        },
        {
          id: 'm-web-2',
          titulo: 'Código y publicación',
          sesiones: ['s-web-3', 's-web-4', 's-web-5', 's-web-6']
        }
      ],
      sesiones: [
        {
          id: 's-web-1',
          modulo: 'm-web-1',
          titulo: 'UX/UI foundations: qué convierte a usuarios',
          tipo: 'grabada',
          dur: 18,
          video: { proveedor: 'youtube', id: 'zjkBMFhNj_g' },
          materiales: [
            { id: 'mat-web-1', nombre: 'Figma template landing.fig', tipo: 'figma', size: '8.4 MB', url: '#' }
          ],
          descripcion: 'Jerarquía visual, tipografía, color, espacios. Por qué algunos sitios convencen en 3 segundos. Ejercicio: wireframe tu página.'
        },
        {
          id: 's-web-2',
          modulo: 'm-web-1',
          titulo: 'Prototipado en Figma: del concepto al asset',
          tipo: 'grabada',
          dur: 16,
          video: { proveedor: 'youtube', id: 'kCc8FmEb1nY' },
          materiales: [
            { id: 'mat-web-2', nombre: 'Guía exportar de Figma.pdf', tipo: 'pdf', size: '1.2 MB', url: '#' }
          ],
          descripcion: 'Crea componentes reutilizables. Variables de color. Auto layout. Exporta assets para web. De prototipo a código en minutos.'
        },
        {
          id: 's-web-3',
          modulo: 'm-web-2',
          titulo: 'HTML semántico y accesibilidad',
          tipo: 'grabada',
          dur: 14,
          video: { proveedor: 'youtube', id: 'l-9ALe3U-Fg' },
          materiales: [
            { id: 'mat-web-3', nombre: 'index.html (template)', tipo: 'html', size: '3.6 KB', url: '#' },
            { id: 'mat-web-4', nombre: 'WCAG checklist.pdf', tipo: 'pdf', size: '890 KB', url: '#' }
          ],
          descripcion: 'Estructura semántica: nav, main, article, footer. Alt text en imágenes. Contraste de color. ARIA labels. Por qué accesibilidad importa.'
        },
        {
          id: 's-web-4',
          modulo: 'm-web-2',
          titulo: 'CSS moderno: Grid, Flexbox y animaciones',
          tipo: 'grabada',
          dur: 19,
          video: { proveedor: 'bunny', libraryId: '239255', videoId: 'd6c3e6b2-8b0a-4a2e-9e0f-demo0000003' },
          materiales: [
            { id: 'mat-web-5', nombre: 'styles.css (completo)', tipo: 'css', size: '6.8 KB', url: '#' }
          ],
          descripcion: 'CSS Grid para layouts. Flexbox para alineación. Transiciones y keyframes. Variables CSS :root. Temas light/dark con media queries.'
        },
        {
          id: 's-web-5',
          modulo: 'm-web-2',
          titulo: 'JavaScript interactivo y performance',
          tipo: 'grabada',
          dur: 17,
          video: { proveedor: 'youtube', id: 'wjZofJX0v4M' },
          materiales: [
            { id: 'mat-web-6', nombre: 'main.js (vanilla JS)', tipo: 'js', size: '4.2 KB', url: '#' }
          ],
          descripcion: 'Event listeners, DOM manipulation, fetch API. Lazy loading de imágenes. Web Vitals: LCP, FID, CLS. Cómo mantener <2s load time.'
        },
        {
          id: 's-web-6',
          modulo: 'm-web-2',
          titulo: 'Deploy: Vercel, Netlify o tu propio hosting',
          tipo: 'grabada',
          dur: 11,
          video: { proveedor: 'youtube', id: 'LPZh9BOjkQs' },
          materiales: [
            { id: 'mat-web-7', nombre: 'guía deploy.md', tipo: 'md', size: '1.9 KB', url: '#' },
            { id: 'mat-web-8', nombre: '.gitignore', tipo: 'txt', size: '120 B', url: '#' }
          ],
          descripcion: 'Git, GitHub Pages, Vercel drag-and-drop, o VPS con nginx. DNS custom domain. SSL gratis con Let\'s Encrypt. Tu web en el mundo.'
        }
      ]
    }
  ],

  rutas: [
    {
      id: 'r-finanzas',
      titulo: 'Finanzas con IA',
      desc: 'Domina contabilidad y finanzas con asistencia de Claude. Desde pólizas hasta reportes ejecutivos.',
      cursoIds: ['c-conta'],
      color: '#22A06B',
      icono: '📊'
    },
    {
      id: 'r-builder',
      titulo: 'Builder IA',
      desc: 'Construye aplicaciones y sitios web impulsados por inteligencia artificial.',
      cursoIds: ['c-app', 'c-web'],
      color: '#8B5CF6',
      icono: '⚡'
    }
  ],

  sesionesVivo: [
    {
      id: 'v-1',
      cursoId: 'c-conta',
      titulo: 'Q&A: cierres mensuales con Claude',
      fechaISO: '2026-07-18T16:00:00-06:00',
      zoomUrl: 'https://zoom.us/j/98211334455?pwd=demo',
      zoomId: '982 1133 4455',
      pass: 'ailearn',
      profesorId: 'prof-1',
      estado: 'en-vivo'
    },
    {
      id: 'v-2',
      cursoId: 'c-conta',
      titulo: 'Casos de auditoría interna',
      fechaISO: '2026-07-22T18:30:00-06:00',
      zoomUrl: 'https://zoom.us/j/98211334456?pwd=demo2',
      zoomId: '982 1133 4456',
      pass: 'ailearn2',
      profesorId: 'prof-1',
      estado: 'programada'
    },
    {
      id: 'v-3',
      cursoId: 'c-app',
      titulo: 'Workshop: Construye tu primer chatbot',
      fechaISO: '2026-07-24T19:00:00-06:00',
      zoomUrl: 'https://zoom.us/j/98211334457?pwd=demo3',
      zoomId: '982 1133 4457',
      pass: 'ailearn3',
      profesorId: 'prof-2',
      estado: 'programada'
    },
    {
      id: 'v-4',
      cursoId: 'c-app',
      titulo: 'Debugging en producción',
      fechaISO: '2026-07-28T17:30:00-06:00',
      zoomUrl: 'https://zoom.us/j/98211334458?pwd=demo4',
      zoomId: '982 1133 4458',
      pass: 'ailearn4',
      profesorId: 'prof-2',
      estado: 'programada'
    },
    {
      id: 'v-5',
      cursoId: 'c-web',
      titulo: 'Critique: tus landing pages',
      fechaISO: '2026-07-30T19:30:00-06:00',
      zoomUrl: 'https://zoom.us/j/98211334459?pwd=demo5',
      zoomId: '982 1133 4459',
      pass: 'ailearn5',
      profesorId: 'prof-3',
      estado: 'programada'
    }
  ],

  foro: [
    {
      id: 'f-1',
      sesionId: 's-conta-1',
      autorId: 'al-2',
      autorTipo: 'alumno',
      texto: 'Mi banco exporta en formato CSV con encoding latin1. ¿Cómo le digo a Claude que lo maneje?',
      ts: 1752868800000,
      respuestas: [
        {
          autorId: 'prof-1',
          autorTipo: 'profesor',
          texto: 'Excelente pregunta. En el prompt, especifica el encoding: "El archivo viene en latin1. Primero conviértelo a UTF-8 o manéjalo explícitamente." Claude entiende codificaciones. También puedes preprocesar con Python + iconv.',
          ts: 1752869400000
        }
      ],
      resuelto: true
    },
    {
      id: 'f-2',
      sesionId: 's-conta-2',
      autorId: 'al-1',
      autorTipo: 'alumno',
      texto: 'La póliza que Claude generó tiene descuadre de 0.01. ¿Errores de redondeo?',
      ts: 1752955200000,
      respuestas: [
        {
          autorId: 'prof-1',
          autorTipo: 'profesor',
          texto: 'Sí, típico con importaciones. Pídele a Claude que valide: "Suma débitos vs créditos. Si hay diferencia, ajusta con una póliza de puente por xxx."',
          ts: 1752956000000
        },
        {
          autorId: 'al-2',
          autorTipo: 'alumno',
          texto: 'Gracias, eso funcionó. Ahora cierra perfecto.',
          ts: 1752957600000
        }
      ],
      resuelto: true
    },
    {
      id: 'f-3',
      sesionId: 's-conta-3',
      autorId: 'al-3',
      autorTipo: 'alumno',
      texto: '¿Cómo valido que Claude reconozca bien los CFDIs? No quiero errores en auditoría.',
      ts: 1753041600000,
      respuestas: [],
      resuelto: false
    },
    {
      id: 'f-4',
      sesionId: 's-app-1',
      autorId: 'al-1',
      autorTipo: 'alumno',
      texto: '¿Qué es un token exactamente? ¿Cómo sé cuántos usa mi prompt?',
      ts: 1753128000000,
      respuestas: [
        {
          autorId: 'prof-2',
          autorTipo: 'profesor',
          texto: 'Token ≈ palabra o fragmento. ~1.3 tokens por palabra en inglés. Usa: `python -c "from anthropic import Anthropic; c = Anthropic(); print(c.messages.count_tokens(text=\'tu texto\'))"` (en la API docs está el método exact).',
          ts: 1753129000000
        }
      ],
      resuelto: false
    },
    {
      id: 'f-5',
      sesionId: 's-app-2',
      autorId: 'al-2',
      autorTipo: 'alumno',
      texto: 'Mi prompt a veces da salida estructurada, a veces texto libre. Temperatura en 0 no ayuda. ¿Qué hago?',
      ts: 1753214400000,
      respuestas: [
        {
          autorId: 'prof-2',
          autorTipo: 'profesor',
          texto: 'Usa JSON schema en el prompt: "Responde SIEMPRE así: {\"campo1\": ..., \"campo2\": ...}". O better: usa `response_format: { type: "json_object" }` en la API (disponible en modelos recientes).',
          ts: 1753215500000
        }
      ],
      resuelto: false
    },
    {
      id: 'f-6',
      sesionId: 's-web-1',
      autorId: 'al-3',
      autorTipo: 'alumno',
      texto: '¿Puedo usar Tailwind en lugar de CSS vanilla? ¿Lo vemos en clase?',
      ts: 1753300800000,
      respuestas: [
        {
          autorId: 'prof-3',
          autorTipo: 'profesor',
          texto: 'Tailwind es excelente, pero en este curso enseñamos CSS puro para que entiendas los fundamentos. Luego Tailwind es un atajo. ¿Quieres un bonus video sobre Tailwind?',
          ts: 1753301800000
        }
      ],
      resuelto: true
    },
    {
      id: 'f-7',
      sesionId: 's-web-2',
      autorId: 'al-1',
      autorTipo: 'alumno',
      texto: 'Mi export de Figma ve pixelado en navegador. ¿Cómo exporto correctamente?',
      ts: 1753387200000,
      respuestas: [],
      resuelto: false
    },
    {
      id: 'f-8',
      sesionId: 's-web-4',
      autorId: 'al-2',
      autorTipo: 'alumno',
      texto: 'Grid vs Flexbox: ¿cuándo usar cuál?',
      ts: 1753473600000,
      respuestas: [
        {
          autorId: 'prof-3',
          autorTipo: 'profesor',
          texto: 'Regla práctica: Flexbox = 1 dimensión (fila o columna). Grid = 2D. Landing page típica: Grid para secciones grandes, Flexbox dentro de cada sección.',
          ts: 1753474600000
        }
      ],
      resuelto: false
    },
    {
      id: 'f-9',
      sesionId: 's-conta-4',
      autorId: 'al-3',
      autorTipo: 'alumno',
      texto: '¿Zapier cobra por integración con Claude?',
      ts: 1753560000000,
      respuestas: [],
      resuelto: false
    }
  ],

  desbloqueos: {
    'emp-conta:c-conta': ['s-conta-1', 's-conta-2', 's-conta-3', 's-conta-4'],
    'emp-dev:c-app': ['s-app-1', 's-app-2'],
    'emp-ail:c-web': ['s-web-1', 's-web-2', 's-web-3', 's-web-4', 's-web-5', 's-web-6']
  },

  progreso: {
    'al-1:s-web-1': { pct: 100, completada: true, ts: 1752700000000 },
    'al-1:s-web-2': { pct: 100, completada: true, ts: 1752750000000 },
    'al-1:s-web-3': { pct: 100, completada: true, ts: 1752800000000 },
    'al-1:s-web-4': { pct: 45, completada: false, ts: 1752850000000 },
    'al-2:s-conta-1': { pct: 100, completada: true, ts: 1752900000000 }
  },

  notificaciones: [
    {
      id: 'notif-1',
      titulo: 'Tienes 1 sesión desbloqueada',
      meta: 'c-conta',
      dot: true
    },
    {
      id: 'notif-2',
      titulo: 'Nuevo quiz: Fundamentos de LLMs',
      meta: 'c-app',
      dot: true
    },
    {
      id: 'notif-3',
      titulo: 'Próxima sesión en vivo hoy a las 16:00',
      meta: 'v-1',
      dot: false
    },
    {
      id: 'notif-4',
      titulo: 'Prof. Sofía respondió a tu pregunta',
      meta: 'f-6',
      dot: true
    }
  ]
};
