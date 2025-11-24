# Stagehand Scrapers - Automotoras

Proyecto de scraping para extracción de datos de automotoras chilenas utilizando Stagehand y Playwright.

## 📋 Descripción

Este proyecto permite realizar scraping automatizado de las páginas web de diferentes automotoras en Chile, extrayendo información de precios, modelos, versiones y características de vehículos.

## 🏗️ Estructura del Proyecto

```
scraping_automotoras/
├── scraping_consecionarias/
│   ├── automotoras/              # Carpetas organizadas por automotora
│   │   ├── apsa_automotora/
│   │   │   ├── csv/              # Datos CSV con URLs
│   │   │   ├── scripts/          # Scripts de scraping específicos
│   │   │   ├── logs/             # Logs de ejecución
│   │   │   ├── results/          # Resultados de scraping
│   │   │   └── README.md
│   │   ├── andesmotor/
│   │   └── ... (87 automotoras más)
│   ├── downloads/
│   ├── output/
│   ├── src/
│   │   ├── config/               # Configuraciones
│   │   ├── scrapers/             # Scrapers base
│   │   ├── test/                 # Tests
│   │   ├── utils/                # Utilidades
│   │   └── index.ts              # Punto de entrada
│   └── tmp/
├── setup_automotoras_folders.ts  # Script de setup
├── list_automotoras_structure.ts # Script de verificación
└── package.json
```

## 🚀 Instalación

```bash
# Instalar dependencias
npm install

# O con yarn
yarn install
```

## 📦 Dependencias Principales

- **@browserbasehq/stagehand**: Framework de scraping con IA
- **@playwright/test**: Automatización de navegador
- **@anthropic-ai/sdk**: SDK de Anthropic Claude
- **csv-parse**: Parser de archivos CSV
- **json2csv**: Conversor JSON a CSV
- **dotenv**: Variables de entorno

## ⚙️ Configuración

### 1. Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
# API Keys
ANTHROPIC_API_KEY=tu_api_key_aqui
OPENAI_API_KEY=tu_api_key_aqui

# Configuración de scraping
HEADLESS=true
TIMEOUT=30000
```

### 2. Setup Inicial - Crear Estructura de Carpetas

Antes de comenzar, debes crear la estructura de carpetas para las automotoras:

```bash
# Crear todas las carpetas de automotoras (89 automotoras)
npm run setup:folders

# Verificar que la estructura se creó correctamente
npm run list:folders
```

Esto creará la siguiente estructura en `scraping_consecionarias/automotoras/`:
- 89 carpetas (una por automotora)
- Cada carpeta con: `csv/`, `scripts/`, `logs/`, `results/`
- Un `README.md` en cada carpeta con información
- Un `INDEX.md` maestro con todas las automotoras

## 📊 Uso

### Scraping Individual

```bash
# Ejecutar un scraper específico
npm run run-scraper src/scrapers/tu_scraper.ts
```

### Scraping Masivo

```bash
# Ejecutar todos los scrapers
npm run scrape-all
```

### Scripts de Setup

```bash
# Crear estructura de carpetas de automotoras
npm run setup:folders

# Listar y verificar estructura creada
npm run list:folders

# Modo desarrollo con hot-reload
npm run setup:dev
```

## 🔧 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm start` | Inicia el scraper principal |
| `npm run run-scraper` | Ejecuta un scraper específico |
| `npm run scrape-all` | Ejecuta todos los scrapers |
| `npm run setup:folders` | Crea estructura de carpetas por automotora |
| `npm run list:folders` | Lista y verifica estructura de carpetas |
| `npm run setup:dev` | Setup en modo desarrollo con watch |

## 📝 Flujo de Trabajo

### 1. Preparación de Datos

1. **Obtener CSV de Metabase** con la consulta SQL:
   ```sql
   SELECT 
       d.nombre as automotora,
       c.marca,
       c.modelo,
       c.version,
       c.ficha_tecnica as url_modelo
   FROM autovolt_car c
   INNER JOIN autovolt_branch_car_brands abcb ON abcb.carbrand_id = c.car_brand_id
   INNER JOIN autovolt_branch b ON b.id = abcb.branch_id
   INNER JOIN autovolt_dealerships d ON d.id = b.dealership_id
   WHERE d.nombre = 'NOMBRE_AUTOMOTORA'
     AND c.ficha_tecnica IS NOT NULL 
     AND c.ficha_tecnica != ''
   ORDER BY c.marca, c.modelo, c.version;
   ```

2. **Colocar CSV** en la carpeta correspondiente:
   ```bash
   scraping_consecionarias/automotoras/nombre_automotora/csv/
   ```

### 2. Desarrollo de Scrapers

1. **Crear scraper** en:
   ```bash
   scraping_consecionarias/automotoras/nombre_automotora/scripts/
   ```

2. **Estructura básica de un scraper**:
   ```typescript
   import { Stagehand } from '@browserbasehq/stagehand';
   import fs from 'fs';
   import path from 'path';
   
   async function scrapeAutomotora() {
     const stagehand = new Stagehand();
     // Tu lógica de scraping aquí
   }
   
   scrapeAutomotora();
   ```

### 3. Ejecución y Monitoreo

1. **Ejecutar scraper**
2. **Revisar logs** en `logs/`
3. **Verificar resultados** en `results/`

## 🏢 Automotoras Disponibles

Total: **89 automotoras**

Algunas principales:
- Derco Center (45 sucursales)
- Rosselot (47 sucursales)
- Salazar Israel (76 sucursales)
- Portillo (75 sucursales)
- Bruno Fritsch (35 sucursales)
- Kaufmann (28 sucursales)
- Y 83 más...

Ver lista completa en: `scraping_consecionarias/automotoras/INDEX.md`

## 🐛 Solución de Problemas

### Error: "Cannot find module 'csv-parse'"
```bash
npm install csv-parse
```

### Error: Estructura de carpetas no existe
```bash
npm run setup:folders
```

### Error: Playwright no instalado
```bash
npx playwright install
```

## 📄 Licencia

ISC

## 👨‍💻 Autor

Erick Noguera

---

**Última actualización**: Noviembre 2024