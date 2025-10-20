import { VOCABULARIO_MEDICO } from './vocabularies/permitido.js';
import { TERMINOS_PROHIBIDOS } from './vocabularies/prohibido.js';

class MedicalWrapper {
    constructor() {
        this.domains = VOCABULARIO_MEDICO.keywords;
        this.anatomical_regions = VOCABULARIO_MEDICO.anatomical_regions;
        this.special_commands = VOCABULARIO_MEDICO.special_commands;
        this.prohibited_terms = TERMINOS_PROHIBIDOS;
        
        // Términos médicos "fuertes" que garantizan aprobación
        this.high_confidence_terms = [
            "anatomía", "fisiología", "farmacología", "patología", "diagnóstico",
            "tratamiento", "fármaco", "órgano", "enfermedad", "síntoma", "signo"
        ];
    }

    classify(question) {
        console.log('🔍 Clasificando pregunta:', question.substring(0, 50));
        
        // VALIDACIÓN BÁSICA
        if (!question || question.trim().length < 3) {
            return this._rejected("Pregunta vacía o demasiado corta");
        }

        const q = question.toLowerCase().trim();
        const qWords = q.split(/\s+/);

        // ═══════════════════════════════════════════════════════
        // NIVEL 1: COMANDOS ESPECIALES (MÁXIMA PRIORIDAD)
        // ═══════════════════════════════════════════════════════
        const specialCommand = this._detectSpecialCommand(q);
        if (specialCommand) {
            return this._handleSpecialCommand(specialCommand, q);
        }

        // ═══════════════════════════════════════════════════════
        // NIVEL 2: TÉRMINOS PROHIBIDOS (RECHAZO INMEDIATO)
        // ═══════════════════════════════════════════════════════
        const prohibitedFound = this._findProhibitedTerms(q);
        if (prohibitedFound.length > 0) {
            return this._rejected(
                `Contiene términos no médicos: ${prohibitedFound.join(', ')}`,
                "Lisabella solo responde preguntas de ciencias médicas"
            );
        }

        // ═══════════════════════════════════════════════════════
        // NIVEL 3: DETECCIÓN DE NOTA MÉDICA
        // ═══════════════════════════════════════════════════════
        if (this._isMedicalNote(question)) {
            return this._approved("análisis clínico", 0.95, { note_analysis: true });
        }

        // ═══════════════════════════════════════════════════════
        // NIVEL 4: ANÁLISIS DE TÉRMINOS MÉDICOS (MEJORADO)
        // ═══════════════════════════════════════════════════════
        const analysis = this._analyzeMedicalContent(q, qWords);
        
        // REGLA 1: Términos médicos "fuertes" → APROBADO automático
        if (analysis.strongMedicalTerms >= 1 && analysis.totalKeywords >= 2) {
            return this._approved(analysis.bestDomain, 0.90);
        }

        // REGLA 2: Suficientes keywords + patrón válido → APROBADO
        if (analysis.totalKeywords >= 3) {
            return this._approved(analysis.bestDomain, 0.85);
        }

        // REGLA 3: Keywords moderados + contexto médico → APROBADO
        if (analysis.totalKeywords >= 2 && analysis.hasMedicalContext) {
            return this._approved(analysis.bestDomain, 0.80);
        }

        // REGLA 4: Términos anatómicos específicos → APROBADO
        if (analysis.anatomicalTerms >= 2) {
            return this._approved("anatomía", 0.85);
        }

        // ═══════════════════════════════════════════════════════
        // NIVEL 5: PREGUNTAS MUY CORTAS
        // ═══════════════════════════════════════════════════════
        if (qWords.length <= 2) {
            return this._handleShortQuestion(q);
        }

        // ═══════════════════════════════════════════════════════
        // NIVEL 6: REFORMULACIÓN INTELIGENTE
        // ═══════════════════════════════════════════════════════
        if (analysis.totalKeywords >= 1) {
            return this._suggestReformulation(
                "Pregunta médica detectada pero muy general",
                this._generateSpecificSuggestions(analysis.detectedKeywords)
            );
        }

        // ═══════════════════════════════════════════════════════
        // DEFAULT: REFORMULAR
        // ═══════════════════════════════════════════════════════
        return this._suggestReformulation(
            "No se detectaron términos médicos específicos",
            this._generateGeneralSuggestions()
        );
    }

    // ==================== MÉTODOS AUXILIARES MEJORADOS ====================

    _analyzeMedicalContent(q, qWords) {
        const domainScores = this._getDomainScores(q);
        const detectedKeywords = this._getDetectedKeywords(q);
        const anatomicalTerms = this.anatomical_regions.filter(term => 
            q.includes(term)
        ).length;
        
        const strongMedicalTerms = this.high_confidence_terms.filter(term =>
            q.includes(term)
        ).length;

        const totalKeywords = Object.values(domainScores).reduce((a, b) => a + b, 0);
        const bestDomain = Object.keys(domainScores).length > 0 
            ? Object.keys(domainScores).reduce((a, b) => domainScores[a] > domainScores[b] ? a : b)
            : "medicina general";

        // Verificar contexto médico (patrones de pregunta médica)
        const medicalPatterns = [
            /\b(?:qué|que|cual|cuales|cuál|cuáles|como|cómo|donde|dónde|por qué|porque)\b.*\b(?:es|son|funciona|se|tiene)\b/,
            /\b(?:explique|explica|describe|detalla|diferencias?|comparación)\b/,
            /\b(?:mecanismo|proceso|función|estructura|ubicación)\b/,
            /\b(?:causas|síntomas|signos|diagnóstico|tratamiento)\b/
        ];

        const hasMedicalContext = medicalPatterns.some(pattern => pattern.test(q));

        return {
            domainScores,
            detectedKeywords,
            anatomicalTerms,
            strongMedicalTerms,
            totalKeywords,
            bestDomain,
            hasMedicalContext
        };
    }

    _getDomainScores(q) {
        const scores = {};
        
        // Búsqueda en keywords principales
        for (const [domain, keywords] of Object.entries(this.domains)) {
            const matches = keywords.filter(kw => {
                // Búsqueda más inteligente: palabras completas
                return q.includes(kw) && 
                       (kw.length > 3 || q.includes(` ${kw} `) || q.startsWith(kw));
            }).length;
            
            if (matches > 0) {
                scores[domain] = matches;
            }
        }
        
        // Búsqueda en regiones anatómicas (bonus para anatomía)
        const anatomicalMatches = this.anatomical_regions.filter(term => 
            q.includes(term)
        ).length;
        
        if (anatomicalMatches > 0) {
            scores["anatomía"] = (scores["anatomía"] || 0) + anatomicalMatches;
        }
        
        return scores;
    }

    _getDetectedKeywords(q) {
        const detected = [];
        
        for (const keywords of Object.values(this.domains)) {
            for (const kw of keywords) {
                if (q.includes(kw) && !detected.includes(kw)) {
                    detected.push(kw);
                }
            }
        }
        
        return detected.slice(0, 8); // Máximo 8 keywords
    }

    _detectSpecialCommand(q) {
        for (const [cmd, triggers] of Object.entries(this.special_commands)) {
            if (triggers.some(trigger => q.includes(trigger))) {
                return cmd;
            }
        }
        return null;
    }

    _handleSpecialCommand(command, q) {
        switch (command) {
            case "revision_nota":
            case "correccion_nota":
            case "elaboracion_nota":
            case "valoracion":
                return this._approved("análisis clínico", 0.95, { 
                    special_command: command 
                });
                
            case "apoyo_estudio":
                const domainScores = this._getDomainScores(q);
                if (Object.keys(domainScores).length > 0) {
                    const bestDomain = Object.keys(domainScores).reduce((a, b) => 
                        domainScores[a] > domainScores[b] ? a : b
                    );
                    return this._approved(bestDomain, 0.85, {
                        special_command: "study_mode"
                    });
                } else {
                    return this._rejected(
                        "El modo 'apoyo en estudio' requiere un tema médico específico",
                        "Ejemplo: 'apoyo en estudio ciclo de Krebs' o 'apoyo en estudio anatomía del tórax'"
                    );
                }
        }
    }

    _findProhibitedTerms(q) {
        return this.prohibited_terms.filter(term => q.includes(term));
    }

    _isMedicalNote(text) {
        const indicators = [
            /\bfecha[:\s]/i,
            /\bmotivo de consulta[:\s]/i,
            /\bexploración física[:\s]/i,
            /\bimpresión diagnóstica[:\s]/i,
            /\bplan[:\s]/i,
            /\b\d+\s*mg\b/,
            /\bta[:\s]\s*\d+\/\d+/,
            /\bfc[:\s]\s*\d+/,
            /\bvo\b.*\bcada\b/i
        ];
        return indicators.filter(ind => ind.test(text)).length >= 3;
    }

    _handleShortQuestion(q) {
        const medicalTerm = this.anatomical_regions.find(term => q.includes(term));
        if (medicalTerm) {
            return this._suggestReformulation(
                `Término médico detectado: '${medicalTerm}', pero la pregunta es muy breve`,
                this._generateTermSuggestions(medicalTerm)
            );
        }
        return this._suggestReformulation(
            "Pregunta demasiado corta",
            "Especifica qué deseas saber:\n• ¿Estructura anatómica?\n• ¿Función fisiológica?\n• ¿Tratamiento farmacológico?\n• ¿Diagnóstico diferencial?"
        );
    }

    // ==================== RESPUESTAS ESTRUCTURADAS ====================

    _approved(domain, confidence, extras = {}) {
        console.log('✅ Pregunta APROBADA:', { domain, confidence, ...extras });
        return {
            result: "APROBADA",
            domain,
            confidence: Number(confidence.toFixed(2)),
            ...extras
        };
    }

    _rejected(reason, suggestion = "") {
        console.log('❌ Pregunta RECHAZADA:', reason);
        return {
            result: "RECHAZADA",
            reason,
            suggestion
        };
    }

    _suggestReformulation(reason, suggestion) {
        console.log('💡 Sugerencia de reformulación:', reason);
        return {
            result: "REFORMULAR",
            reason,
            suggestion
        };
    }

    _generateSpecificSuggestions(keywords) {
        if (keywords.length === 0) return this._generateGeneralSuggestions();
        
        return `**Detecté términos médicos: ${keywords.join(', ')}**

**Para una respuesta más precisa, reformula como:**

• "¿Cuál es la **estructura anatómica** de ${keywords[0]}?"
• "¿Qué **función fisiológica** tiene ${keywords[0]}?"
• "¿Cómo funciona el **mecanismo de acción** de ${keywords[0]}?"
• "¿Qué **patologías** afectan a ${keywords[0]}?"`;
    }

    _generateGeneralSuggestions() {
        return `**Para obtener una respuesta precisa, reformula usando términos médicos específicos:**

• **Anatómicos**: "articulación", "sistema nervioso", "región abdominal"
• **Fisiológicos**: "homeostasis", "metabolismo", "regulación hormonal"  
• **Farmacológicos**: "mecanismo de acción", "farmacocinética", "dosis terapéutica"
• **Patológicos**: "etiología", "fisiopatología", "diagnóstico diferencial"

**Ejemplo de pregunta bien formulada:**
"¿Cuál es el mecanismo de acción del losartán en la hipertensión arterial?"`;
    }

    _generateTermSuggestions(term) {
        return `**Preguntas sugeridas sobre '${term}':**

• ¿Cuál es la **estructura anatómica** del ${term}?
• ¿Cuál es la **función fisiológica** del ${term}?
• ¿Dónde se **ubica** exactamente el ${term}?
• ¿Qué **irrigación** e **inervación** tiene?
• ¿Qué **patologías** pueden afectarlo?
• ¿Qué **estudios diagnósticos** lo evalúan?`;
    }

    getStats() {
        return {
            domains_count: Object.keys(this.domains).length,
            anatomical_regions: this.anatomical_regions.length,
            prohibited_terms: this.prohibited_terms.length,
            special_commands: Object.keys(this.special_commands).length
        };
    }
}

export default MedicalWrapper;
