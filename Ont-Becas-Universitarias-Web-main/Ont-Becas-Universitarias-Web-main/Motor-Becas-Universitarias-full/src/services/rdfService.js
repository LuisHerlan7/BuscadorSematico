const fs = require('fs');
const path = require('path');

// Rutas de los archivos ontológicos
const defaultOwl = path.join(__dirname, '../public/data/ontologia_becas.owl');
const rdfFilePath = process.env.ONTOLOGY_FILE || defaultOwl;

// Términos genéricos que describen la ontología o conectores comunes
const GENERIC_TERMS = new Set([
  'beca', 'becas', 'universitaria', 'universitarias', 
  'universitario', 'universitarios', 'universidad', 'universidades',
  'estudio', 'estudios', 'programa', 'programas', 'de', 'para', 'en'
]);

const OFFLINE_I18N = {
  Offline_Fulbright_Competencia: {
    es: {
      label: 'Programa Fulbright - Respaldo Offline',
      amount: 'Completa o parcial: matricula, manutencion, seguro medico, pasajes internacionales y materiales de investigacion',
      requirements: 'Licenciatura concluida, promedio minimo 80/100, certificacion TOEFL o IELTS, cartas de recomendacion, propuesta de investigacion, experiencia academica previa y entrevista.',
      benefits: 'Cobertura de matricula, manutencion mensual, alojamiento parcial, transporte internacional, seguro medico, tutoria academica y apoyo para materiales.'
    },
    en: {
      label: 'Fulbright Program - Offline Backup',
      amount: 'Full or partial: tuition, living stipend, health insurance, international travel and research materials',
      requirements: 'Completed bachelor degree, minimum GPA 80/100, TOEFL or IELTS certificate, recommendation letters, research proposal, previous academic experience and interview.',
      benefits: 'Tuition coverage, monthly stipend, partial housing, international travel, health insurance, academic tutoring and materials support.'
    },
    pt: {
      label: 'Programa Fulbright - Apoio Offline',
      amount: 'Total ou parcial: matricula, manutencao, seguro medico, passagens internacionais e materiais de pesquisa',
      requirements: 'Licenciatura concluida, media minima 80/100, certificacao TOEFL ou IELTS, cartas de recomendacao, proposta de pesquisa, experiencia academica previa e entrevista.',
      benefits: 'Cobertura de matricula, manutencao mensal, alojamento parcial, transporte internacional, seguro medico, tutoria academica e apoio para materiais.'
    },
    de: {
      label: 'Fulbright-Programm - Offline-Sicherung',
      amount: 'Voll oder teilweise: Studiengebuehren, Lebensunterhalt, Krankenversicherung, internationale Reise und Forschungsmaterialien',
      requirements: 'Abgeschlossenes Bachelorstudium, Mindestdurchschnitt 80/100, TOEFL- oder IELTS-Zertifikat, Empfehlungsschreiben, Forschungsvorhaben, akademische Erfahrung und Interview.',
      benefits: 'Studiengebuehren, monatlicher Zuschuss, teilweise Unterkunft, internationale Reise, Krankenversicherung, akademische Betreuung und Materialunterstuetzung.'
    },
    fr: {
      label: 'Programme Fulbright - Sauvegarde hors ligne',
      amount: 'Totale ou partielle : frais de scolarite, allocation, assurance medicale, voyage international et materiel de recherche',
      requirements: 'Licence terminee, moyenne minimale 80/100, certification TOEFL ou IELTS, lettres de recommandation, projet de recherche, experience academique et entretien.',
      benefits: 'Frais de scolarite, allocation mensuelle, logement partiel, transport international, assurance medicale, tutorat academique et soutien materiel.'
    }
  },
  Offline_Erasmus_Competencia: {
    es: { label: 'Beca Erasmus+ - Respaldo Offline', amount: 'Parcial: matricula de intercambio, manutencion, alojamiento parcial y transporte', requirements: 'Estar matriculado en una universidad participante, promedio minimo 70/100, certificado de idioma, plan de estudios aprobado, pasaporte y carta de motivacion.', benefits: 'Movilidad internacional, manutencion, apoyo para alojamiento, pasajes, seguro medico, tutoria, practicas profesionales e intercambio academico.' },
    en: { label: 'Erasmus+ Scholarship - Offline Backup', amount: 'Partial: exchange tuition, living support, partial housing and transport', requirements: 'Enrollment at a participating university, minimum GPA 70/100, language certificate, approved study plan, passport and motivation letter.', benefits: 'International mobility, living support, housing support, travel, health insurance, tutoring, internships and academic exchange.' },
    pt: { label: 'Bolsa Erasmus+ - Apoio Offline', amount: 'Parcial: matricula de intercambio, manutencao, alojamento parcial e transporte', requirements: 'Estar matriculado em uma universidade participante, media minima 70/100, certificado de idioma, plano de estudos aprovado, passaporte e carta de motivacao.', benefits: 'Mobilidade internacional, manutencao, apoio para alojamento, passagens, seguro medico, tutoria, estagios profissionais e intercambio academico.' },
    de: { label: 'Erasmus+-Stipendium - Offline-Sicherung', amount: 'Teilweise: Austauschgebuehren, Lebensunterhalt, teilweise Unterkunft und Transport', requirements: 'Immatrikulation an einer Partneruniversitaet, Mindestdurchschnitt 70/100, Sprachzertifikat, genehmigter Studienplan, Reisepass und Motivationsschreiben.', benefits: 'Internationale Mobilitaet, Lebensunterhalt, Unterkunftszuschuss, Reise, Krankenversicherung, Betreuung, Praktika und akademischer Austausch.' },
    fr: { label: 'Bourse Erasmus+ - Sauvegarde hors ligne', amount: 'Partielle : frais d echange, allocation, logement partiel et transport', requirements: 'Inscription dans une universite participante, moyenne minimale 70/100, certificat de langue, plan d etudes approuve, passeport et lettre de motivation.', benefits: 'Mobilite internationale, allocation, aide au logement, voyage, assurance medicale, tutorat, stages et echange academique.' }
  },
  Offline_DAAD_Competencia: {
    es: { label: 'Beca DAAD - Respaldo Offline', amount: 'Completa: estipendio mensual, matricula, seguro medico, viaje y materiales de investigacion', requirements: 'Excelencia academica, titulo universitario, certificacion de aleman o ingles, TOEFL o IELTS cuando corresponda, propuesta de investigacion y cartas de recomendacion.', benefits: 'Matricula, manutencion, alojamiento parcial, seguro medico, transporte, curso de idioma, tutoria y materiales academicos.' },
    en: { label: 'DAAD Scholarship - Offline Backup', amount: 'Full: monthly stipend, tuition, health insurance, travel and research materials', requirements: 'Academic excellence, university degree, German or English certificate, TOEFL or IELTS when required, research proposal and recommendation letters.', benefits: 'Tuition, living stipend, partial housing, health insurance, transport, language course, tutoring and academic materials.' },
    pt: { label: 'Bolsa DAAD - Apoio Offline', amount: 'Total: bolsa mensal, matricula, seguro medico, viagem e materiais de pesquisa', requirements: 'Excelencia academica, diploma universitario, certificacao de alemao ou ingles, TOEFL ou IELTS quando exigido, proposta de pesquisa e cartas de recomendacao.', benefits: 'Matricula, manutencao, alojamento parcial, seguro medico, transporte, curso de idioma, tutoria e materiais academicos.' },
    de: { label: 'DAAD-Stipendium - Offline-Sicherung', amount: 'Voll: monatliches Stipendium, Studiengebuehren, Krankenversicherung, Reise und Forschungsmaterialien', requirements: 'Akademische Exzellenz, Hochschulabschluss, Deutsch- oder Englischzertifikat, TOEFL oder IELTS falls erforderlich, Forschungsvorhaben und Empfehlungsschreiben.', benefits: 'Studiengebuehren, Lebensunterhalt, teilweise Unterkunft, Krankenversicherung, Transport, Sprachkurs, Betreuung und Studienmaterialien.' },
    fr: { label: 'Bourse DAAD - Sauvegarde hors ligne', amount: 'Complete : allocation mensuelle, frais de scolarite, assurance medicale, voyage et materiel de recherche', requirements: 'Excellence academique, diplome universitaire, certificat d allemand ou d anglais, TOEFL ou IELTS si requis, projet de recherche et lettres de recommandation.', benefits: 'Frais de scolarite, allocation, logement partiel, assurance medicale, transport, cours de langue, tutorat et materiel academique.' }
  },
  Offline_Chevening_Competencia: {
    es: { label: 'Beca Chevening - Respaldo Offline', amount: 'Completa: matricula, manutencion, viaje internacional, visa y seguro', requirements: 'Licenciatura, dos anos de experiencia laboral, dominio de ingles, liderazgo demostrado, referencias, admision universitaria y entrevista.', benefits: 'Matricula completa, estipendio, transporte, seguro medico, red profesional, tutoria y oportunidades de practicas.' },
    en: { label: 'Chevening Scholarship - Offline Backup', amount: 'Full: tuition, living stipend, international travel, visa and insurance', requirements: 'Bachelor degree, two years of work experience, English proficiency, proven leadership, references, university admission and interview.', benefits: 'Full tuition, stipend, transport, health insurance, professional network, tutoring and internship opportunities.' },
    pt: { label: 'Bolsa Chevening - Apoio Offline', amount: 'Total: matricula, manutencao, viagem internacional, visto e seguro', requirements: 'Licenciatura, dois anos de experiencia profissional, dominio de ingles, lideranca comprovada, referencias, admissao universitaria e entrevista.', benefits: 'Matricula integral, bolsa, transporte, seguro medico, rede profissional, tutoria e oportunidades de estagio.' },
    de: { label: 'Chevening-Stipendium - Offline-Sicherung', amount: 'Voll: Studiengebuehren, Lebensunterhalt, internationale Reise, Visum und Versicherung', requirements: 'Bachelorabschluss, zwei Jahre Berufserfahrung, Englischkenntnisse, Fuehrungserfahrung, Referenzen, Zulassung und Interview.', benefits: 'Volle Studiengebuehren, Zuschuss, Transport, Krankenversicherung, berufliches Netzwerk, Betreuung und Praktikumsmoeglichkeiten.' },
    fr: { label: 'Bourse Chevening - Sauvegarde hors ligne', amount: 'Complete : frais de scolarite, allocation, voyage international, visa et assurance', requirements: 'Licence, deux ans d experience professionnelle, anglais, leadership, references, admission universitaire et entretien.', benefits: 'Frais complets, allocation, transport, assurance medicale, reseau professionnel, tutorat et stages.' }
  },
  Offline_Beca_Socioeconomica_Competencia: {
    es: { label: 'Beca Socioeconomica Universitaria - Respaldo Offline', amount: 'Parcial: matricula, alimentacion, alojamiento y manutencion', requirements: 'Promedio minimo 65/100, informe socioeconomico, notas, matricula vigente, solicitud y documentos familiares.', benefits: 'Exencion parcial de matricula, alimentacion, alojamiento, tutoria y acompanamiento academico.' },
    en: { label: 'University Socioeconomic Scholarship - Offline Backup', amount: 'Partial: tuition, meals, housing and living support', requirements: 'Minimum GPA 65/100, socioeconomic report, transcripts, active enrollment, request letter and family documents.', benefits: 'Partial tuition waiver, meals, housing, tutoring and academic support.' },
    pt: { label: 'Bolsa Socioeconomica Universitaria - Apoio Offline', amount: 'Parcial: matricula, alimentacao, alojamento e manutencao', requirements: 'Media minima 65/100, relatorio socioeconomico, historico, matricula vigente, solicitacao e documentos familiares.', benefits: 'Isencao parcial de matricula, alimentacao, alojamento, tutoria e acompanhamento academico.' },
    de: { label: 'Soziooekonomisches Universitaetsstipendium - Offline-Sicherung', amount: 'Teilweise: Studiengebuehren, Verpflegung, Unterkunft und Lebensunterhalt', requirements: 'Mindestdurchschnitt 65/100, soziooekonomischer Bericht, Noten, aktive Immatrikulation, Antrag und Familiendokumente.', benefits: 'Teilweiser Gebuehrenerlass, Verpflegung, Unterkunft, Betreuung und akademische Begleitung.' },
    fr: { label: 'Bourse universitaire socio-economique - Sauvegarde hors ligne', amount: 'Partielle : frais, alimentation, logement et allocation', requirements: 'Moyenne minimale 65/100, rapport socio-economique, releves, inscription active, demande et documents familiaux.', benefits: 'Exoneration partielle, alimentation, logement, tutorat et accompagnement academique.' }
  },
  Offline_Google_Tecnologia_Competencia: {
    es: { label: 'Beca Google Tecnologia - Respaldo Offline', amount: 'Parcial: apoyo economico, materiales, cursos, mentoria y certificaciones', requirements: 'Estudiante tecnico o universitario, promedio minimo 75/100, interes en tecnologia, ensayo y certificado academico.', benefits: 'Apoyo economico, materiales, tutoria, certificaciones, practicas profesionales y red de mentores.' },
    en: { label: 'Google Technology Scholarship - Offline Backup', amount: 'Partial: financial aid, materials, courses, mentoring and certifications', requirements: 'Technical or university student, minimum GPA 75/100, interest in technology, essay and academic certificate.', benefits: 'Financial aid, materials, tutoring, certifications, internships and mentor network.' },
    pt: { label: 'Bolsa Google Tecnologia - Apoio Offline', amount: 'Parcial: apoio financeiro, materiais, cursos, mentoria e certificacoes', requirements: 'Estudante tecnico ou universitario, media minima 75/100, interesse em tecnologia, ensaio e certificado academico.', benefits: 'Apoio financeiro, materiais, tutoria, certificacoes, estagios e rede de mentores.' },
    de: { label: 'Google-Technologiestipendium - Offline-Sicherung', amount: 'Teilweise: finanzielle Hilfe, Materialien, Kurse, Mentoring und Zertifikate', requirements: 'Technik- oder Hochschulstudent, Mindestdurchschnitt 75/100, Interesse an Technologie, Essay und Leistungsnachweis.', benefits: 'Finanzielle Hilfe, Materialien, Betreuung, Zertifikate, Praktika und Mentorennetzwerk.' },
    fr: { label: 'Bourse Google Technologie - Sauvegarde hors ligne', amount: 'Partielle : aide financiere, materiel, cours, mentorat et certifications', requirements: 'Etudiant technique ou universitaire, moyenne minimale 75/100, interet pour la technologie, essai et certificat academique.', benefits: 'Aide financiere, materiel, tutorat, certifications, stages et reseau de mentors.' }
  },
  Offline_Resumen_40_Preguntas: {
    es: { label: 'Resumen Offline de Preguntas de Competencia' },
    en: { label: 'Offline Summary of Competency Questions' },
    pt: { label: 'Resumo Offline das Perguntas de Competencia' },
    de: { label: 'Offline-Zusammenfassung der Kompetenzfragen' },
    fr: { label: 'Resume hors ligne des questions de competence' }
  }
};

class RDFService {
  constructor() {
    this.engine = null;
    this.fileContent = null;
    this.mediaType = null;
    this.offlineDbpediaRecords = null;
  }

  _ensureLoaded() {
    if (this.engine && this.fileContent && this.mediaType) return;

    const { QueryEngine } = require('@comunica/query-sparql');
    this.engine = new QueryEngine();

    // Resolvemos la ruta absoluta del archivo ontológico
    const filePath = path.resolve(rdfFilePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`No se encontró el archivo ontológico en: ${filePath}`);
    }
    
    // Cargamos el contenido del archivo en memoria para evitar accesos repetitivos a disco
    this.fileContent = fs.readFileSync(filePath, 'utf8');
    
    this.mediaType = 'application/rdf+xml';
  }

  _getComunicaSources() {
    this._ensureLoaded();

    return [{
      type: 'serialized',
      value: this.fileContent,
      mediaType: this.mediaType,
      baseIRI: 'http://www.semanticweb.org/ontologia/becas-universitarias#'
    }];
  }

  async _queryBindings(query) {
    const sources = this._getComunicaSources();
    const bindingsStream = await this.engine.queryBindings(query, { sources });
    const bindings = [];

    await new Promise((resolve, reject) => {
      bindingsStream.on('data', b => {
        const plain = new Map();
        for (const [key, value] of b) {
          const keyName = key?.value || key?.id || String(key).replace(/^\?/, '');
          plain.set(keyName, value ? {
            value: value.value,
            language: value.language,
            datatype: value.datatype?.value,
            termType: value.termType
          } : null);
        }
        bindings.push(plain);
      });
      bindingsStream.on('end', resolve);
      bindingsStream.on('error', reject);
    });

    return bindings;
  }

  _normalize(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
  }

  _isGenericScholarshipSearch(term) {
    const normalized = this._normalize(term);
    return [
      'beca', 'becas', 'scholarship', 'scholarships', 'bolsa', 'bolsas', 'bourse', 'stipendium',
      'estudiante', 'estudiantes', 'student', 'students', 'estudante', 'estudantes', 'etudiant', 'etudiants', 'studenten'
    ].includes(normalized);
  }

  _pickLiteral(group, field, lang = 'es') {
    const values = group[field] || [];
    const preferred = values.find(v => v.lang === lang)
      || values.find(v => v.lang === 'es')
      || values.find(v => v.lang === 'en')
      || values[0];

    return preferred?.value || null;
  }

  _fragment(uri) {
    return String(uri || '').split('#').pop() || String(uri || '').replace(/^offline-dbpedia:/, '');
  }

  _langRank(valueLang, selectedLang) {
    if (valueLang === selectedLang) return 0;
    if (valueLang === 'es') return 1;
    if (valueLang === 'en') return 2;
    if (!valueLang) return 3;
    return 4;
  }

  _applyOfflineI18n(item, lang = 'es') {
    const fragment = this._fragment(item.uri || item.ontologyUri);
    const text = OFFLINE_I18N[fragment]?.[lang];
    if (!text) return item;

    const description = text.description || this._offlineDescription(fragment, lang) || item.description;

    return {
      ...item,
      label: text.label || item.label,
      name: text.label || item.name,
      description,
      abstract: description || item.abstract,
      amount: text.amount || item.amount,
      requirements: text.requirements || item.requirements,
      benefits: text.benefits || item.benefits,
      institution: text.institution || this._localizeControlledText(item.institution, lang),
      level: text.level || this._localizeControlledText(item.level, lang),
      area: text.area || this._localizeControlledText(item.area, lang),
      country: text.country || this._localizeControlledText(item.country, lang)
    };
  }

  _offlineDescription(fragment, lang = 'es') {
    const descriptions = {
      Offline_Fulbright_Competencia: {
        en: 'International research, master and doctoral scholarship offered by Fulbright commissions, host universities and government sponsors.',
        pt: 'Bolsa internacional de pesquisa, mestrado e doutorado oferecida por comissoes Fulbright, universidades anfitrias e organismos governamentais.',
        de: 'Internationales Forschungs-, Master- und Promotionsstipendium von Fulbright-Kommissionen, Gastuniversitaeten und staatlichen Traegern.',
        fr: 'Bourse internationale de recherche, master et doctorat proposee par les commissions Fulbright, universites d accueil et organismes publics.'
      },
      Offline_Erasmus_Competencia: {
        en: 'Mobility and academic exchange program for undergraduate, master and professional internship studies in European universities.',
        pt: 'Programa de mobilidade e intercambio academico para graduacao, mestrado e estagios profissionais em universidades europeias.',
        de: 'Mobilitaets- und Austauschprogramm fuer Bachelor, Master und Praktika an europaeischen Universitaeten.',
        fr: 'Programme de mobilite et d echange academique pour licence, master et stages professionnels dans des universites europeennes.'
      },
      Offline_DAAD_Competencia: {
        en: 'German scholarship for master, doctorate, research and specialization courses.',
        pt: 'Bolsa alema para mestrado, doutorado, pesquisa e cursos de especializacao.',
        de: 'Deutsches Stipendium fuer Master, Promotion, Forschung und Spezialisierungskurse.',
        fr: 'Bourse allemande pour master, doctorat, recherche et cours de specialisation.'
      },
      Offline_Chevening_Competencia: {
        en: 'Full United Kingdom Government scholarship for master studies and leadership development.',
        pt: 'Bolsa integral do Governo do Reino Unido para mestrado e desenvolvimento de lideranca.',
        de: 'Vollstipendium der Regierung des Vereinigten Koenigreichs fuer Masterstudium und Fuehrung.',
        fr: 'Bourse complete du Gouvernement du Royaume-Uni pour master et developpement du leadership.'
      },
      Offline_Beca_Socioeconomica_Competencia: {
        en: 'Partial national scholarship for undergraduate students with socioeconomic vulnerability.',
        pt: 'Bolsa nacional parcial para estudantes de graduacao em vulnerabilidade socioeconomica.',
        de: 'Teilweises nationales Stipendium fuer Bachelorstudierende mit soziooekonomischer Benachteiligung.',
        fr: 'Bourse nationale partielle pour etudiants de licence en vulnerabilite socio-economique.'
      },
      Offline_Google_Tecnologia_Competencia: {
        en: 'Excellence scholarship for computer science, technology and engineering students in Latin America.',
        pt: 'Bolsa de excelencia para estudantes de informatica, tecnologia e engenharia na America Latina.',
        de: 'Exzellenzstipendium fuer Informatik-, Technologie- und Ingenieurstudierende in Lateinamerika.',
        fr: 'Bourse d excellence pour etudiants en informatique, technologie et ingenierie en Amerique latine.'
      },
      Offline_Resumen_40_Preguntas: {
        en: 'Offline summary covering scholarship programs, institutions, requirements, benefits, application stages, selection criteria, beneficiaries and statistics.',
        pt: 'Resumo offline sobre programas de bolsas, instituicoes, requisitos, beneficios, etapas de candidatura, criterios de selecao, beneficiarios e estatisticas.',
        de: 'Offline-Zusammenfassung zu Stipendienprogrammen, Einrichtungen, Anforderungen, Leistungen, Bewerbungsschritten, Auswahlkriterien, Beguenstigten und Statistiken.',
        fr: 'Resume hors ligne sur les programmes de bourses, institutions, exigences, avantages, etapes de candidature, criteres de selection, beneficiaires et statistiques.'
      }
    };

    return descriptions[fragment]?.[lang] || null;
  }

  _localizeControlledText(value, lang = 'es') {
    if (!value || lang === 'es') return value;

    const dictionary = {
      en: {
        'Comisión': 'Commission', 'universidades': 'universities', 'comité evaluador': 'evaluation committee',
        'Unión Europea': 'European Union', 'oficinas de relaciones internacionales': 'international relations offices',
        'Servicio Alemán de Intercambio Académico': 'German Academic Exchange Service',
        'Gobierno del Reino Unido': 'United Kingdom Government',
        'Universidades nacionales': 'National universities',
        'Maestría': 'Master', 'Doctorado': 'Doctorate', 'Investigación': 'Research', 'Pregrado': 'Undergraduate',
        'Postdoctorado': 'Postdoctoral', 'Intercambio': 'Exchange', 'Especialización': 'Specialization',
        'Todas las áreas': 'All areas', 'movilidad': 'mobility', 'idiomas': 'languages', 'prácticas profesionales': 'internships',
        'Ingeniería': 'Engineering', 'tecnología': 'technology', 'ciencias': 'sciences', 'artes': 'arts',
        'ciencias sociales': 'social sciences', 'educación': 'education', 'salud': 'health', 'administración': 'administration', 'liderazgo': 'leadership',
        'investigación': 'research', 'Políticas públicas': 'Public policy', 'áreas de estudio': 'study areas', 'Informática': 'Computer science',
        'Reino Unido': 'United Kingdom', 'Alemania': 'Germany', 'España': 'Spain', 'Francia': 'France', 'países participantes': 'participating countries'
      },
      pt: {
        'Comisión': 'Comissao', 'universidades': 'universidades', 'comité evaluador': 'comite avaliador',
        'Unión Europea': 'Uniao Europeia', 'oficinas de relaciones internacionales': 'escritorios de relacoes internacionais',
        'Servicio Alemán de Intercambio Académico': 'Servico Alemao de Intercambio Academico',
        'Gobierno del Reino Unido': 'Governo do Reino Unido',
        'Universidades nacionales': 'Universidades nacionais',
        'Maestría': 'Mestrado', 'Doctorado': 'Doutorado', 'Investigación': 'Pesquisa', 'Pregrado': 'Graduacao',
        'Postdoctorado': 'Pos-doutorado', 'Intercambio': 'Intercambio', 'Especialización': 'Especializacao',
        'Todas las áreas': 'Todas as areas', 'movilidad': 'mobilidade', 'idiomas': 'idiomas', 'prácticas profesionales': 'estagios profissionais',
        'Ingeniería': 'Engenharia', 'tecnología': 'tecnologia', 'ciencias': 'ciencias', 'artes': 'artes',
        'ciencias sociales': 'ciencias sociais', 'educación': 'educacao', 'salud': 'saude', 'administración': 'administracao', 'liderazgo': 'lideranca',
        'investigación': 'pesquisa', 'Políticas públicas': 'Politicas publicas', 'áreas de estudio': 'areas de estudo', 'Informática': 'Informatica',
        'estudio': 'estudo',
        'universidades alemanas': 'universidades alemas', 'universidades británicas': 'universidades britanicas', 'fundaciones tecnológicas': 'fundacoes tecnologicas',
        'dirección de bienestar estudiantil': 'direcao de bem-estar estudantil', 'comité socioeconómico': 'comite socioeconomico',
        'latinoamericanas': 'latino-americanas', 'informática': 'informatica', 'ingeniería': 'engenharia', 'ciencia de datos': 'ciencia de dados', 'áreas de estudio': 'areas de estudo',
        'Reino Unido': 'Reino Unido', 'Alemania': 'Alemanha', 'España': 'Espanha', 'Francia': 'Franca', 'países participantes': 'paises participantes'
      },
      de: {
        'Comisión': 'Kommission', 'universidades': 'Universitaeten', 'comité evaluador': 'Bewertungsausschuss',
        'Unión Europea': 'Europaeische Union', 'oficinas de relaciones internacionales': 'Auslandsaemter',
        'Servicio Alemán de Intercambio Académico': 'Deutscher Akademischer Austauschdienst',
        'Gobierno del Reino Unido': 'Regierung des Vereinigten Koenigreichs',
        'Universidades nacionales': 'Nationale Universitaeten',
        'Maestría': 'Master', 'Doctorado': 'Promotion', 'Investigación': 'Forschung', 'Pregrado': 'Bachelor',
        'Postdoctorado': 'Postdoktorat', 'Intercambio': 'Austausch', 'Especialización': 'Spezialisierung',
        'Todas las áreas': 'Alle Fachbereiche', 'movilidad': 'Mobilitaet', 'idiomas': 'Sprachen', 'prácticas profesionales': 'Praktika',
        'Ingeniería': 'Ingenieurwesen', 'tecnología': 'Technologie', 'ciencias': 'Wissenschaften', 'artes': 'Kuenste',
        'ciencias sociales': 'Sozialwissenschaften', 'educación': 'Bildung', 'salud': 'Gesundheit', 'administración': 'Verwaltung', 'liderazgo': 'Fuehrung',
        'investigación': 'Forschung', 'Políticas públicas': 'Oeffentliche Politik', 'áreas de estudio': 'Studienbereiche', 'Informática': 'Informatik',
        'universidades alemanas': 'deutsche Universitaeten', 'universidades británicas': 'britische Universitaeten', 'fundaciones tecnológicas': 'Technologiestiftungen',
        'dirección de bienestar estudiantil': 'Studierendenwerk', 'comité socioeconómico': 'soziooekonomischer Ausschuss',
        'latinoamericanas': 'lateinamerikanische', 'informática': 'Informatik', 'ingeniería': 'Ingenieurwesen', 'ciencia de datos': 'Datenwissenschaft', 'áreas de estudio': 'Studienbereiche',
        'Reino Unido': 'Vereinigtes Koenigreich', 'Alemania': 'Deutschland', 'España': 'Spanien', 'Francia': 'Frankreich', 'países participantes': 'teilnehmende Laender'
      },
      fr: {
        'Comisión': 'Commission', 'universidades': 'universites', 'comité evaluador': 'comite evaluateur',
        'Unión Europea': 'Union europeenne', 'oficinas de relaciones internacionales': 'bureaux des relations internationales',
        'Servicio Alemán de Intercambio Académico': 'Service allemand d echanges universitaires',
        'Gobierno del Reino Unido': 'Gouvernement du Royaume-Uni',
        'Universidades nacionales': 'Universites nationales',
        'Maestría': 'Master', 'Doctorado': 'Doctorat', 'Investigación': 'Recherche', 'Pregrado': 'Licence',
        'Postdoctorado': 'Postdoctorat', 'Intercambio': 'Echange', 'Especialización': 'Specialisation',
        'Todas las áreas': 'Tous les domaines', 'movilidad': 'mobilite', 'idiomas': 'langues', 'prácticas profesionales': 'stages',
        'Ingeniería': 'Ingenierie', 'tecnología': 'technologie', 'ciencias': 'sciences', 'artes': 'arts',
        'ciencias sociales': 'sciences sociales', 'educación': 'education', 'salud': 'sante', 'administración': 'administration', 'liderazgo': 'leadership',
        'investigación': 'recherche', 'Políticas públicas': 'Politiques publiques', 'áreas de estudio': 'domaines d etude', 'Informática': 'informatique',
        'universidades alemanas': 'universites allemandes', 'universidades británicas': 'universites britanniques', 'fundaciones tecnológicas': 'fondations technologiques',
        'dirección de bienestar estudiantil': 'direction du bien-etre etudiant', 'comité socioeconómico': 'comite socio-economique',
        'latinoamericanas': 'latino-americaines', 'informática': 'informatique', 'ingeniería': 'ingenierie', 'ciencia de datos': 'science des donnees', 'áreas de estudio': 'domaines d etude',
        'Reino Unido': 'Royaume-Uni', 'Alemania': 'Allemagne', 'España': 'Espagne', 'Francia': 'France', 'países participantes': 'pays participants'
      }
    };

    let result = String(value);
    for (const [from, to] of Object.entries(dictionary[lang] || {})) {
      result = result.split(from).join(to);
    }
    return result;
  }

  _mapOfflineGroup(uri, group, lang = 'es') {
    const label = this._pickLiteral(group, 'labels', lang) || uri;
    const description = this._pickLiteral(group, 'descriptions', lang) || '';
    const fragment = uri.split('#').pop() || uri;
    const publicUri = `offline-dbpedia:${fragment}`;

    return this._applyOfflineI18n({
      uri: publicUri,
      safeUri: encodeURIComponent(publicUri),
      ontologyUri: uri,
      dbpediaUri: group.dbpediaUri || null,
      dbpediaPage: group.dbpediaUri || null,
      label,
      name: label,
      description,
      abstract: description,
      type: group.type || null,
      institution: group.institution || null,
      level: group.level || null,
      area: group.area || null,
      country: group.country || null,
      amount: group.amount || null,
      deadline: group.deadline || null,
      requirements: this._pickLiteral(group, 'requirements', lang),
      benefits: this._pickLiteral(group, 'benefits', lang),
      seeAlso: group.seeAlso || null,
      thumbnail: null,
      source: 'dbpedia-offline'
    }, lang);
  }

  _decodeXml(value) {
    return String(value || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  _extractFirst(block, tagName) {
    const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`);
    const match = block.match(pattern);
    return match ? this._decodeXml(match[1].trim()) : null;
  }

  _extractLiterals(block, tagName) {
    const pattern = new RegExp(`<${tagName}([^>]*)>([\\s\\S]*?)<\\/${tagName}>`, 'g');
    const values = [];
    let match;

    while ((match = pattern.exec(block)) !== null) {
      const langMatch = match[1].match(/xml:lang="([^"]+)"/);
      values.push({
        lang: langMatch ? langMatch[1] : '',
        value: this._decodeXml(match[2].trim())
      });
    }

    return values;
  }

  _extractResource(block, tagName) {
    const pattern = new RegExp(`<${tagName}[^>]*rdf:resource="([^"]+)"`);
    const match = block.match(pattern);
    return match ? this._decodeXml(match[1]) : null;
  }

  _loadOfflineDbpediaRecords() {
    if (this.offlineDbpediaRecords) return this.offlineDbpediaRecords;

    const filePath = path.resolve(rdfFilePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const individualPattern = /<owl:NamedIndividual\s+rdf:about="([^"]+)">([\s\S]*?)<\/owl:NamedIndividual>/g;
    const records = new Map();
    let match;

    while ((match = individualPattern.exec(content)) !== null) {
      const [, about, block] = match;
      if (!block.includes('<esRespaldoDBpedia')) continue;

      const typeResource = this._extractResource(block, 'rdf:type');
      const labels = this._extractLiterals(block, 'rdfs:label');
      const descriptions = this._extractLiterals(block, 'descripción');
      const requirements = this._extractLiterals(block, 'requisitosTexto');
      const benefits = this._extractLiterals(block, 'beneficiosTexto');
      const dbpediaUri = this._extractResource(block, 'owl:sameAs');
      const seeAlso = this._extractResource(block, 'rdfs:seeAlso');

      const uri = about.startsWith('#')
        ? `http://www.semanticweb.org/ontologia/becas-universitarias${about}`
        : about;

      records.set(uri, {
        labels,
        descriptions,
        requirements,
        benefits,
        type: typeResource ? typeResource.replace('#', '') : null,
        amount: this._extractFirst(block, 'montoCubierto'),
        deadline: this._extractFirst(block, 'fechaLímitePostulación'),
        institution: this._extractFirst(block, 'institucionTexto'),
        level: this._extractFirst(block, 'nivelTexto'),
        area: this._extractFirst(block, 'areaTexto'),
        country: this._extractFirst(block, 'paisTexto'),
        dbpediaUri,
        seeAlso
      });
    }

    this.offlineDbpediaRecords = records;
    return records;
  }

  _offlineSearchText(group) {
    return [
      ...(group.labels || []).map(item => item.value),
      ...(group.descriptions || []).map(item => item.value),
      ...(group.requirements || []).map(item => item.value),
      ...(group.benefits || []).map(item => item.value),
      group.type,
      group.institution,
      group.level,
      group.area,
      group.country
    ].join(' ');
  }

  async _getOfflineDbpediaGroups() {
    return this._loadOfflineDbpediaRecords();
  }

  async searchOfflineDbpediaScholarships(term, lang = 'es') {
    const groups = await this._getOfflineDbpediaGroups();
    const words = this._normalize(term).split(/\s+/).filter(Boolean);
    const isGeneric = !term || !String(term).trim() || this._isGenericScholarshipSearch(term);

    return Array.from(groups.entries())
      .filter(([, group]) => {
        if (isGeneric) return true;
        const haystack = this._normalize(this._offlineSearchText(group));
        return words.every(word => haystack.includes(word));
      })
      .map(([uri, group]) => this._mapOfflineGroup(uri, group, lang));
  }

  async getOfflineDbpediaScholarshipDetails(uri, lang = 'es') {
    const groups = await this._getOfflineDbpediaGroups();
    const target = String(uri || '')
      .replace(/^offline-dbpedia:/, '')
      .toLowerCase();

    for (const [subject, group] of groups.entries()) {
      const fragment = (subject.split('#').pop() || subject).toLowerCase();
      if (subject === uri || group.dbpediaUri === uri || fragment === target) {
        return this._mapOfflineGroup(subject, group, lang);
      }
    }

    return null;
  }

  /**
   * Tokeniza y normaliza el término de búsqueda
   */
  _parseSearchKeywords(term) {
    if (!term) return [];
    const normalized = term
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
    
    return normalized.split(/\s+/).filter(w => w.length >= 2);
  }

  /**
   * Filtra términos genéricos para quedarse con las palabras clave específicas
   */
  _getSpecificKeywords(keywords) {
    const expanded = [];
    const synonymMap = {
      estudante: ['estudiante', 'estudiantes', 'student', 'students', 'beneficiario', 'postulante'],
      estudantes: ['estudiante', 'estudiantes', 'student', 'students', 'beneficiario', 'postulante'],
      student: ['estudiante', 'estudiantes', 'student', 'students', 'beneficiario', 'postulante'],
      students: ['estudiante', 'estudiantes', 'student', 'students', 'beneficiario', 'postulante'],
      etudiant: ['estudiante', 'estudiantes', 'student', 'students', 'beneficiario', 'postulante'],
      etudiants: ['estudiante', 'estudiantes', 'student', 'students', 'beneficiario', 'postulante'],
      studenten: ['estudiante', 'estudiantes', 'student', 'students', 'beneficiario', 'postulante'],
      bolsa: ['beca', 'scholarship', 'bourse', 'stipendium'],
      bourse: ['beca', 'scholarship', 'bolsa', 'stipendium'],
      stipendium: ['beca', 'scholarship', 'bolsa', 'bourse']
    };

    for (const w of keywords) expanded.push(...(synonymMap[w] || [w]));

    return Array.from(new Set(expanded)).filter(w => {
      let stem = w;
      // Singularización básica para español
      if (w.endsWith('es') && w.length > 4) {
        stem = w.slice(0, -2);
      } else if (w.endsWith('s') && !w.endsWith('es') && w.length > 3) {
        stem = w.slice(0, -1);
      }
      return !GENERIC_TERMS.has(w) && !GENERIC_TERMS.has(stem);
    });
  }

  /**
   * Construye dinámicamente la cláusula FILTER en SPARQL para admitir búsquedas multi-palabra y evitar búsquedas vacías
   */
  _buildSPARQLFilter(term) {
    const keywords = this._parseSearchKeywords(term);
    const specific = this._getSpecificKeywords(keywords);

    if (specific.length === 0) {
      // Si la búsqueda solo contiene términos genéricos (ej. "becas universitarias"),
      // devolvemos todas las becas de la ontología sin aplicar filtro rígido de texto.
      return '';
    }

    // Si contiene palabras clave específicas, construimos filtros tolerantes con OR (||)
    const filterClauses = specific.map(word => {
      const escaped = word.replace(/"/g, '\\"');
      return `(
        CONTAINS(LCASE(COALESCE(STR(?label), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?nombre), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?descripcion), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?requisitosTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?beneficiosTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?institucionTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?nivelTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?areaTexto), "")), "${escaped}")
        || CONTAINS(LCASE(COALESCE(STR(?paisTexto), "")), "${escaped}")
      )`;
    });

    return `FILTER(${filterClauses.join(' || ')})`;
  }

  async searchScholarships(term, lang = 'es') {
    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      SELECT DISTINCT ?s ?label ?descripcion ?monto ?fechaFinal ?nombre ?requisitosTexto ?beneficiosTexto ?institucionTexto ?nivelTexto ?areaTexto ?paisTexto WHERE {
        {
          # Buscar instancias de Beca o cualquier subclase de Beca
          ?s a ?type .
          ?type rdfs:subClassOf* becas:Beca .
        } UNION {
          # Fallback: cualquier entidad con nombreBeca es una beca
          ?s becas:nombreBeca ?anyNombre .
        }
        ?s rdfs:label ?label .
        FILTER(LANG(?label) = "${lang}" || LANG(?label) = "es" || LANG(?label) = "en" || LANG(?label) = "")
        OPTIONAL { ?s becas:descripcion ?descripcionSinTilde }
        OPTIONAL { ?s becas:descripción ?descripcionConTilde }
        OPTIONAL { ?s becas:requisitosTexto ?requisitosTexto }
        OPTIONAL { ?s becas:beneficiosTexto ?beneficiosTexto }
        OPTIONAL { ?s becas:institucionTexto ?institucionTexto }
        OPTIONAL { ?s becas:nivelTexto ?nivelTexto }
        OPTIONAL { ?s becas:areaTexto ?areaTexto }
        OPTIONAL { ?s becas:paisTexto ?paisTexto }
        OPTIONAL { ?s becas:montoCubierto ?monto }
        OPTIONAL { ?s becas:fechaLímitePostulación ?fecha }
        OPTIONAL { ?s becas:fechaLimitePostulacion ?fechaAlt }
        OPTIONAL { ?s becas:nombreBeca ?nombre }
        BIND(COALESCE(?fecha, ?fechaAlt) AS ?fechaFinal)
        BIND(COALESCE(?descripcionSinTilde, ?descripcionConTilde) AS ?descripcion)
      } LIMIT 200
    `;

    const bindings = await this._queryBindings(query);
    const specific = this._getSpecificKeywords(this._parseSearchKeywords(term));

    const mapped = bindings.map(binding => {
      const s = binding.get('s') || binding.get('?s');
      const label = binding.get('label') || binding.get('?label');
      const descripcion = binding.get('descripcion') || binding.get('?descripcion');
      const monto = binding.get('monto') || binding.get('?monto');
      const fecha = binding.get('fechaFinal') || binding.get('?fechaFinal') || binding.get('fecha') || binding.get('?fecha');
      const nombre = binding.get('nombre') || binding.get('?nombre');
      const requisitos = binding.get('requisitosTexto') || binding.get('?requisitosTexto');
      const beneficios = binding.get('beneficiosTexto') || binding.get('?beneficiosTexto');
      const institucion = binding.get('institucionTexto') || binding.get('?institucionTexto');
      const nivel = binding.get('nivelTexto') || binding.get('?nivelTexto');
      const area = binding.get('areaTexto') || binding.get('?areaTexto');
      const pais = binding.get('paisTexto') || binding.get('?paisTexto');

      return {
        uri: s?.value,
        label: label?.value,
        labelLang: label?.language || '',
        name: nombre?.value || label?.value,
        description: descripcion?.value,
        amount: monto?.value,
        deadline: fecha?.value,
        requirements: requisitos?.value,
        benefits: beneficios?.value,
        institution: institucion?.value,
        level: nivel?.value,
        area: area?.value,
        country: pais?.value,
        source: 'local'
      };
    });

    const deduped = [];
    const byUri = new Map();

    for (const item of mapped) {
      if (!item.uri) continue;

      const haystack = this._normalize([
        item.label,
        item.name,
        item.description,
        item.requirements,
        item.benefits,
        item.institution,
        item.level,
        item.area,
        item.country
      ].join(' '));

      if (specific.length > 0 && !specific.some(word => haystack.includes(word))) continue;

      const current = byUri.get(item.uri);
      if (!current || this._langRank(item.labelLang, lang) < this._langRank(current.labelLang, lang)) {
        byUri.set(item.uri, item);
      }
    }

    for (const item of byUri.values()) {
      const localized = this._applyOfflineI18n(item, lang);
      delete localized.labelLang;
      deduped.push(localized);
    }

    return deduped.slice(0, 50);
  }

  async getScholarshipDetails(uri, lang = 'es') {
    const query = `
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX becas: <http://www.semanticweb.org/ontologia/becas-universitarias#>
      SELECT ?p ?o ?oLbl WHERE {
        <${uri}> ?p ?o .
        OPTIONAL {
          ?o rdfs:label ?oLbl .
        }
      }
    `;

    const bindings = await this._queryBindings(query);

    const NS = 'http://www.semanticweb.org/ontologia/becas-universitarias#';
    const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
    const OWL = 'http://www.w3.org/2002/07/owl#';

    const raw = {};
    const requirements = [];
    const benefits = [];
    const labels = [];
    const descriptions = [];
    let institution = null;
    let level = null;
    let area = null;
    let country = null;

    bindings.forEach(binding => {
      const p = binding.get('p') || binding.get('?p');
      const o = binding.get('o') || binding.get('?o');
      const oLbl = binding.get('oLbl') || binding.get('?oLbl');

      if (!p || !o) return;

      const propUri = p.value;
      const objVal = o.value;
      const objLabel = oLbl ? oLbl.value : objVal.split('#')[1] || objVal;

      raw[propUri] = objVal;

      if (propUri === `${RDFS}label`) {
        labels.push({ value: objVal, lang: o.language || '' });
      } else if (propUri === `${NS}descripción` || propUri === `${NS}descripcion`) {
        descriptions.push({ value: objVal, lang: o.language || '' });
      } else if (propUri === `${NS}tieneRequisito`) {
        requirements.push(objLabel);
      } else if (propUri === `${NS}otorgaBeneficio`) {
        benefits.push(objLabel);
      } else if (propUri === `${NS}esOfrecidaPor`) {
        institution = objLabel;
      } else if (propUri === `${NS}perteneceANivel`) {
        level = objLabel;
      } else if (propUri === `${NS}perteneceAArea` || propUri === `${NS}perteneceAÁrea`) {
        area = objLabel;
      } else if (propUri === `${NS}destinadaAPais` || propUri === `${NS}destinadaAPaís`) {
        country = objLabel;
      }
    });

    const pickLang = values => {
      const preferred = values.find(v => v.lang === lang)
        || values.find(v => v.lang === 'es')
        || values.find(v => v.lang === 'en')
        || values[0];
      return preferred?.value || null;
    };

    const label = pickLang(labels) || raw[`${NS}nombreBeca`] || uri;
    const desc = pickLang(descriptions) || raw[`${NS}descripcion`] || raw[`${NS}descripción`] || '';
    const amount = raw[`${NS}montoCubierto`] || null;
    const deadline = raw[`${NS}fechaLímitePostulación`] || raw[`${NS}fechaLimitePostulacion`] || null;
    const dbpediaUri = raw[`${OWL}sameAs`] || null;
    const seeAlso = raw[`${RDFS}seeAlso`] || null;
    const requirementsText = raw[`${NS}requisitosTexto`] || null;
    const benefitsText = raw[`${NS}beneficiosTexto`] || null;
    const institutionText = raw[`${NS}institucionTexto`] || null;
    const levelText = raw[`${NS}nivelTexto`] || null;
    const areaText = raw[`${NS}areaTexto`] || null;
    const countryText = raw[`${NS}paisTexto`] || null;

    return this._applyOfflineI18n({
      uri,
      label,
      name: label,
      abstract: desc,
      description: desc,
      amount,
      deadline,
      dbpediaUri,
      seeAlso,
      requirements: requirements.length > 0 ? requirements.join(', ') : requirementsText,
      benefits: benefits.length > 0 ? benefits.join(', ') : benefitsText,
      institution: institution || institutionText,
      level: level || levelText,
      area: area || areaText,
      country: country || countryText,
      thumbnail: null,
      source: 'local',
      _raw: raw
    }, lang);
  }
}

module.exports = new RDFService();
