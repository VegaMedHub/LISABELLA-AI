/**
 * WRAPPER - CLASIFICADOR DE PREGUNTAS MÉDICAS
 * Motor de validación y clasificación de preguntas
 * Retorna: APROBADA, RECHAZADA, REFORMULAR
 */

import { 
  Result, 
  MEDICAL_DOMAINS, 
  SPECIAL_COMMANDS, 
  PROHIBITED_TERMS,
  log 
} from './config.js';

class Wrapper {
  constructor() {
    this.domains = MEDICAL_DOMAINS;
    this.specialCommands = SPECIAL_COMMANDS;
    this.prohibitedTerms = PROHIBITED_TERMS;
  }

  /**
   * CLASIFICAR PREGUNTA MÉDICA
   * Niveles de clasificación:
   * 1. Detectar comando especial
   * 2. Rechazar términos prohibidos
   * 3. Detectar nota médica completa
   * 4. Buscar keywords por dominio
   * 5. Retornar resultado
   */
  classify(question) {
    log('debug', 'Clasificando pregunta', { question: question.substring(0, 50) });

    // ═══════════════════════════════════════════════════════
    // VALIDACIÓN INICIAL
    // ═══════════════════════════════════════════════════════
    if (!question || question.trim().length < 3) {
      log('warn', 'Pregunta rechazada: vacía o muy corta');
      return {
        result: Result.REJECTED,
        reason: "Pregunta vacía o demasiado corta",
        suggestion: "Escribe al menos 3 caracteres"
      };
    }

    const q = question.toLowerCase().trim();
    const qWords = q.split(/\s+/);

    // ═══════════════════════════════════════════════════════
    // NIVEL 0: DETECTAR COMANDOS ESPECIALES (prioridad máxima)
    // ═══════════════════════════════════════════════════════
    const specialCommand = this._detectSpecialCommand(question);
    if (specialCommand) {
      log('info', 'Comando especial detectado', { command: specialCommand });
      
      if (['revision_nota', 'correccion_nota', 'elaboracion_nota', 'valoracion'].includes(specialCommand)) {
        return {
          result: Result.APPROVED,
          domain: "análisis clínico",
          confidence: 0.95,
          special_command: specialCommand
        };
      }

      if (specialCommand === 'apoyo_estudio') {
        const domainScores = this._getDomainScores(q);
        if (Object.keys(domainScores).length > 0) {
          const bestDomain = Object.keys(domainScores).reduce((a, b) => 
            domainScores[a] > domainScores[b] ? a : b
          );
          return {
            result: Result.APPROVED,
            domain: bestDomain,
            confidence: 0.85,
            special_command: 'study_mode'
          };
        } else {
          return {
            result: Result.REJECTED,
            reason: "El modo 'apoyo en estudio' requiere un tema médico válido",
            suggestion: "Ejemplo: 'apoyo en estudio ciclo de Krebs' o 'apoyo en estudio anatomía del tórax'"
          };
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // NIVEL 1: DETECTAR NOTAS MÉDICAS COMPLETAS
    // ═══════════════════════════════════════════════════════
    if (this._isMedicalNote(question)) {
      log('info', 'Nota médica detectada automáticamente');
      return {
        result: Result.APPROVED,
        domain: "análisis clínico",
        confidence: 0.95,
        note_analysis: true
      };
    }

    // ═══════════════════════════════════════════════════════
    // NIVEL 2: RECHAZAR TÉRMINOS PROHIBIDOS
    // ═══════════════════════════════════════════════════════
    const prohibitedFound = this.prohibitedTerms.filter(term => q.includes(term));
    if (prohibitedFound.length > 0) {
      log('warn', 'Términos prohibidos detectados', { terms: prohibitedFound });
      return {
        result: Result.REJECTED,
        reason: `Contiene términos no médicos: ${prohibitedFound.join(', ')}`,
        suggestion: "Lisabella solo responde preguntas de ciencias médicas"
      };
    }

    // ═══════════════════════════════════════════════════════
    // NIVEL 3: PREGUNTAS MUY CORTAS (1-2 palabras)
    // ═══════════════════════════════════════════════════════
    if (qWords.length <= 2) {
      const medicalTerm = this._extractMedicalTerm(q);
      if (medicalTerm) {
        log('warn', 'Pregunta muy corta con término médico', { term: medicalTerm });
        return {
          result: Result.REFORMULATE,
          reason: `Término médico detectado: '${medicalTerm}', pero la pregunta es muy breve`,
          suggestion: this._generateTermSuggestions(medicalTerm)
        };
      } else {
        log('warn', 'Pregunta muy corta sin términos médicos');
        return {
          result: Result.REFORMULATE,
          reason: "Pregunta demasiado corta",
          suggestion: "Especifica qué deseas saber:\n• ¿Estructura anatómica?\n• ¿Función fisiológica?\n• ¿Tratamiento farmacolóxico?\n• ¿Diagnóstico diferencial?"
        };
      }
    }

    // ═══════════════════════════════════════════════════════
    // NIVEL 4: BUSCAR KEYWORDS MÉDICOS POR DOMINIO
    // ═══════════════════════════════════════════════════════
    const domainScores = this._getDomainScores(q);
    const totalKeywords = Object.values(domainScores).reduce((a, b) => a + b, 0);

    // REGLA CRÍTICA: Si tiene ≥3 keywords médicos, APROBAR
    if (totalKeywords >= 3) {
      const bestDomain = Object.keys(domainScores).reduce((a, b) => 
        domainScores[a] > domainScores[b] ? a : b
      );
      const confidence = Math.min(0.92, 0.70 + (totalKeywords * 0.06));
      log('info', 'Pregunta aprobada por keywords', { domain: bestDomain, keywords: totalKeywords });
      return {
        result: Result.APPROVED,
        domain: bestDomain,
        confidence: Number(confidence.toFixed(2))
      };
    }

    // Si tiene 2 keywords, aceptar con confianza media
    if (totalKeywords >= 2) {
      const bestDomain = Object.keys(domainScores).reduce((a, b) => 
        domainScores[a] > domainScores[b] ? a : b
      );
      log('info', 'Pregunta aprobada (confianza media)', { domain: bestDomain, keywords: totalKeywords });
      return {
        result: Result.APPROVED,
        domain: bestDomain,
        confidence: 0.75
      };
    }

    // ═══════════════════════════════════════════════════════
    // NIVEL 5: DETECTAR PATRONES DE PREGUNTAS VÁLIDAS
    // ═══════════════════════════════════════════════════════
    const validPatterns = [
      /\b(qué|que|cual|cuales|cuál|cuáles|como|cómo|donde|dónde|por qué|porque|por que)\b/,
      /\b(explique|explica|describe|detalla|detalle|menciona|lista|enumera)\b/,
      /\b(diferencia|comparación|comparacion|relación|relacion|asociación|asociacion)\b/,
      /\b(mecanismo|proceso|función|funcion|estructura|ubicación|ubicacion)\b/,
      /\b(causas|síntomas|sintomas|signos|diagnóstico|diagnostico|tratamiento)\b/
    ];

    const hasValidPattern = validPatterns.some(pattern => pattern.test(q));

    if (hasValidPattern && domainScores) {
      log('info', 'Pregunta con patrón válido y keywords');
      const bestDomain = Object.keys(domainScores).length > 0 
        ? Object.keys(domainScores).reduce((a, b) => domainScores[a] > domainScores[b] ? a : b)
        : "medicina general";
      
      return {
        result: Result.APPROVED,
        domain: bestDomain,
        confidence: 0.70
      };
    }

    // ═══════════════════════════════════════════════════════
    // DEFAULT: REFORMULAR
    // ═══════════════════════════════════════════════════════
    log('warn', 'Pregunta requiere reformulación');
    return {
      result: Result.REFORMULATE,
      reason: "No se detectaron términos médicos específicos",
      suggestion: "**Para obtener una respuesta precisa, reformula usando:**\n\n• **Términos anatómicos**: estructura, ubicación, función de órganos\n• **Términos farmacolóxicos**: mecanismo de acción, dosis, efectos adversos\n• **Términos patolóxicos**: etiología, fisiopatología, diagnóstico\n• **Términos clínicos**: síntomas, signos, tratamiento, pronóstico"
    };
  }

  // ═══════════════════════════════════════════════════════
  // MÉTODOS AUXILIARES PRIVADOS
  // ═══════════════════════════════════════════════════════

  _detectSpecialCommand(question) {
    const q = question.toLowerCase();
    for (const [cmd, triggers] of Object.entries(this.specialCommands)) {
      if (triggers.some(trigger => q.includes(trigger))) {
        return cmd;
      }
    }
    return null;
  }

  _getDomainScores(q) {
    const scores = {};
    for (const [domain, keywords] of Object.entries(this.domains)) {
      const matches = keywords.filter(kw => q.includes(kw)).length;
      if (matches > 0) {
        scores[domain] = matches;
      }
    }
    return scores;
  }

  _isMedicalNote(text) {
    const indicators = [
      /\bfecha[:\s]/,
      /\bmotivo de consulta[:\s]/,
      /\bexploración física[:\s]/,
      /\bimpresión diagnóstica[:\s]/,
      /\bplan[:\s]/,
      /\bedad[:\s]\s*\d+/,
      /\b\d+\s*mg\b/,
      /\b\d+\s*mmhg\b/,
      /\bfc[:\s]\s*\d+/,
      /\bta[:\s]\s*\d+\/\d+/
    ];
    const matches = indicators.filter(ind => ind.test(text.toLowerCase())).length;
    return matches >= 3;
  }

  _extractMedicalTerm(text) {
    const anatomicalRegions = [
      "precordial", "torácico", "abdominal", "cervical", "lumbar", "craneal", "pélvico",
      "timo", "corazón", "hígado", "riñón", "pulmón", "cerebro", "estómago", "intestino",
      "páncreas", "bazo", "tiroides", "suprarrenal", "hipófisis", "médula espinal"
    ];

    for (const term of anatomicalRegions) {
      if (text.includes(term)) {
        return term;
      }
    }
    return null;
  }

  _generateTermSuggestions(term) {
    return `**Preguntas sugeridas sobre '${term}':**\n\n• ¿Cuál es la **estructura anatómica** del ${term}?\n• ¿Cuál es la **función fisiológica** del ${term}?\n• ¿Dónde se **ubica** el ${term}?\n• ¿Qué **irrigación** tiene el ${term}?\n• ¿Qué **patologías** afectan al ${term}?`;
  }

  getStats() {
    return {
      domains_count: Object.keys(this.domains).length,
      keywords_total: Object.values(this.domains).reduce((sum, kws) => sum + kws.length, 0),
      special_commands: Object.keys(this.specialCommands).length,
      prohibited_terms: this.prohibitedTerms.length
    };
  }
}

export default Wrapper;
