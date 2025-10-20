// src/vocabularies/permitidos.js
export const DOMINIOS_MEDICOS = {
  keywords: {
    "anatomía": [
      "arteria", "vena", "nervio", "órgano", "estructura", "ubicación", 
      "región", "músculo", "hueso", "ligamento", "articulación", "fascia", 
      "plexo", "topografía", "abdomen", "abdominal", "cuadrante", "región",
      "espacio", "triángulo", "fosa", "canal", "conducto"
    ],
    "farmacología": [
      "fármaco", "medicamento", "mecanismo", "dosis", "acción", "tratamiento",
      "farmacocinética", "farmacodinámica", "biodisponibilidad", "vida media",
      "efectos adversos", "contraindicaciones",
      // FÁRMACOS ESPECÍFICOS (como en tu Python)
      "espironolactona", "metformina", "losartán", "enalapril", "omeprazol",
      "ibuprofeno", "paracetamol", "aspirina", "atorvastatina", "simvastatina"
    ],
    // ... 43 especialidades más
  },
  
  special_commands: {
    "revision_nota": ["revisar nota", "revision de nota", "revisa nota médica"],
    "correccion_nota": ["corregir nota", "correccion de nota", "corrige nota médica"],
    "elaboracion_nota": ["elaborar nota", "elaboracion de nota", "hacer nota", "crear nota"],
    "valoracion": ["valor
