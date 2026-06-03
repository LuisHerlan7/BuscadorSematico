const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');

module.exports = function(app) {
  // Configuración de idiomas soportados
  const supportedLangs = {
    es: 'Español',
    en: 'English',
    pt: 'Português',
    fr: 'Français',
    de: 'Deutsch'
  };

  // Crear instancia de Handlebars con helpers para i18n
  const hbs = exphbs.create({
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: {
      // Helper para codificación URI
      encodeURI: function(uri) {
        return encodeURIComponent(uri);
      },
      encodeURIComponent: function(uri) {
        return encodeURIComponent(uri);
      },
      
      // Helper para truncar texto
      truncate: function(str, len) {
        if (str && str.length > len) {
          return str.substring(0, len) + '...';
        }
        return str;
      },
      
      // Helper para año actual
      currentYear: function() {
        return new Date().getFullYear();
      },
      
      // Helper para dividir strings
      split: function(str, index) {
        return str ? str.split(' ')[index] : '';
      },
      
      // Helper para comparación estricta
      eq: (a, b) => a === b,
      
      // Helper para comparación de idioma
      isLang: function(lang, options) {
        return this.lang === lang ? options.fn(this) : options.inverse(this);
      },
      
      // Helper para obtener texto traducido
      t: function(key, options) {
        const translations = {
          'site_title': {
            es: 'Buscador de Becas',
            en: 'Scholarship Finder',
            pt: 'Buscador de Bolsas',
            fr: 'Recherche de Bourses',
            de: 'Stipendien-Suche'
          },
          'search_placeholder': {
            es: 'Buscar becas (ej. Excelencia, Movilidad, institución)...',
            en: 'Search scholarships (e.g. Excellence, Mobility, institution)...',
            pt: 'Pesquisar bolsas (ex: Excelência, Mobilidade, instituição)...',
            fr: 'Rechercher des bourses (ex: Excellence, Mobilité, institution)...',
            de: 'Stipendien suchen (z.B. Excellence, Mobilität, Institution)...'
          },
          'search_button': {
            es: 'Buscar',
            en: 'Search',
            pt: 'Pesquisar',
            fr: 'Rechercher',
            de: 'Suchen'
          },
          'no_results': {
            es: 'No se encontraron resultados',
            en: 'No results found',
            pt: 'Nenhum resultado encontrado',
            fr: 'Aucun résultat trouvé',
            de: 'Keine Ergebnisse gefunden'
          }
          ,
          'hero_title': {
            es: 'Buscador de Becas',
            en: 'Scholarship Finder',
            pt: 'Buscador de Bolsas',
            fr: 'Recherche de Bourses',
            de: 'Stipendien-Suche'
          },
          'hero_subtitle': {
            es: 'Explora Becas Universitarias',
            en: 'Explore University Scholarships',
            pt: 'Explore Bolsas Universitárias',
            fr: 'Explorez les bourses universitaires',
            de: 'Entdecken Sie Universitätsstipendien'
          },
          'hero_p1': {
            es: 'Bienvenido a nuestro buscador especializado en becas universitarias. Encuentra convocatorias, requisitos y detalles de programas de financiamiento para estudiantes.',
            en: 'Welcome to our specialized scholarship finder. Find calls, requirements and details of funding programs for students.',
            pt: 'Bem-vindo ao nosso buscador especializado em bolsas universitárias. Encontre chamadas, requisitos e detalhes de programas de financiamento para estudantes.',
            fr: 'Bienvenue sur notre moteur de recherche spécialisé dans les bourses universitaires. Trouvez les appels, les conditions et les détails des programmes de financement pour les étudiants.',
            de: 'Willkommen bei unserer spezialisierten Stipendiensuche. Finden Sie Ausschreibungen, Anforderungen und Details zu Förderprogrammen für Studierende.'
          },
          'hero_p2': {
            es: 'Busca becas por nombre, institución, nivel académico o área de conocimiento. Explora requisitos, montos y fechas de postulación para planificar tu postulación.',
            en: 'Search scholarships by name, institution, academic level or field of study. Explore requirements, amounts and application dates to plan your application.',
            pt: 'Pesquise bolsas por nome, instituição, nível acadêmico ou área de conhecimento. Explore requisitos, valores e datas de inscrição para planejar sua inscrição.',
            fr: "Recherchez des bourses par nom, institution, niveau académique ou domaine d'études. Explorez les exigences, les montants et les dates de candidature pour planifier votre candidature.",
            de: 'Suchen Sie Stipendien nach Name, Institution, akademischem Niveau oder Fachbereich. Informieren Sie sich über Voraussetzungen, Beträge und Bewerbungsfristen, um Ihre Bewerbung zu planen.'
          },
          'source_local': {
            es: 'Ontología Local',
            en: 'Local Ontology',
            pt: 'Ontologia Local',
            fr: 'Ontologie Locale',
            de: 'Lokale Ontologie'
          },
          'source_dbpedia': {
            es: 'DBpedia',
            en: 'DBpedia',
            pt: 'DBpedia',
            fr: 'DBpedia',
            de: 'DBpedia'
          },
          'source_dbpedia_offline': {
            es: 'DBpedia Offline',
            en: 'Offline DBpedia',
            pt: 'DBpedia Offline',
            fr: 'DBpedia Hors Ligne',
            de: 'DBpedia Offline'
          },
          'amount': {
            es: 'Monto',
            en: 'Amount',
            pt: 'Valor',
            fr: 'Montant',
            de: 'Betrag'
          },
          'deadline': {
            es: 'Fecha límite',
            en: 'Deadline',
            pt: 'Prazo final',
            fr: 'Date limite',
            de: 'Frist'
          },
          'source': {
            es: 'Fuente',
            en: 'Source',
            pt: 'Fonte',
            fr: 'Source',
            de: 'Quelle'
          },
          'actions': {
            es: 'Acciones',
            en: 'Actions',
            pt: 'Ações',
            fr: 'Actions',
            de: 'Aktionen'
          },
          'view_details': {
            es: 'Ver Detalles',
            en: 'View Details',
            pt: 'Ver Detalhes',
            fr: 'Voir les Détails',
            de: 'Details Anzeigen'
          },
          'save': {
            es: 'Guardar',
            en: 'Save',
            pt: 'Salvar',
            fr: 'Enregistrer',
            de: 'Speichern'
          },
          'saved': {
            es: 'Guardado',
            en: 'Saved',
            pt: 'Salvo',
            fr: 'Enregistré',
            de: 'Gespeichert'
          },
          'already_saved': {
            es: 'Ya guardado',
            en: 'Already saved',
            pt: 'Já salvo',
            fr: 'Déjà enregistré',
            de: 'Bereits gespeichert'
          },
          'uri_unavailable': {
            es: 'URI no disponible',
            en: 'URI unavailable',
            pt: 'URI indisponível',
            fr: 'URI indisponible',
            de: 'URI nicht verfügbar'
          },
          'footer_title': {
            es: 'Buscador de Becas Universitarias',
            en: 'University Scholarship Finder',
            pt: 'Buscador de Bolsas Universitárias',
            fr: 'Recherche de Bourses Universitaires',
            de: 'Universitätsstipendien-Suche'
          },
          'footer_data': {
            es: 'Datos locales y DBpedia (según disponibilidad)',
            en: 'Local data and DBpedia (subject to availability)',
            pt: 'Dados locais e DBpedia (conforme disponibilidade)',
            fr: 'Données locales et DBpedia (selon disponibilité)',
            de: 'Lokale Daten und DBpedia (je nach Verfügbarkeit)'
          },
          'general_info': {
            es: 'Información General',
            en: 'General Information',
            pt: 'Informações Gerais',
            fr: 'Informations Générales',
            de: 'Allgemeine Informationen'
          },
          'scholarship_badge': {
            es: 'Beca Universitaria',
            en: 'University Scholarship',
            pt: 'Bolsa Universitária',
            fr: 'Bourse Universitaire',
            de: 'Universitätsstipendium'
          },
          'description': {
            es: 'Descripción',
            en: 'Description',
            pt: 'Descrição',
            fr: 'Description',
            de: 'Beschreibung'
          },
          'no_description': {
            es: 'No hay descripción disponible para esta beca.',
            en: 'No description is available for this scholarship.',
            pt: 'Não há descrição disponível para esta bolsa.',
            fr: "Aucune description n'est disponible pour cette bourse.",
            de: 'Für dieses Stipendium ist keine Beschreibung verfügbar.'
          },
          'requirements': {
            es: 'Requisitos / Elegibilidad',
            en: 'Requirements / Eligibility',
            pt: 'Requisitos / Elegibilidade',
            fr: 'Conditions / Éligibilité',
            de: 'Anforderungen / Eignung'
          },
          'benefits': {
            es: 'Beneficios / Cobertura',
            en: 'Benefits / Coverage',
            pt: 'Benefícios / Cobertura',
            fr: 'Avantages / Couverture',
            de: 'Leistungen / Abdeckung'
          },
          'institution': {
            es: 'Institución',
            en: 'Institution',
            pt: 'Instituição',
            fr: 'Institution',
            de: 'Institution'
          },
          'level': {
            es: 'Nivel',
            en: 'Level',
            pt: 'Nível',
            fr: 'Niveau',
            de: 'Niveau'
          },
          'area': {
            es: 'Área',
            en: 'Area',
            pt: 'Área',
            fr: 'Domaine',
            de: 'Bereich'
          },
          'country': {
            es: 'País de Destino',
            en: 'Destination Country',
            pt: 'País de Destino',
            fr: 'Pays de Destination',
            de: 'Zielland'
          },
          'back_results': {
            es: 'Volver a resultados',
            en: 'Back to results',
            pt: 'Voltar aos resultados',
            fr: 'Retour aux résultats',
            de: 'Zurück zu den Ergebnissen'
          },
          'official_site': {
            es: 'Visitar Sitio Oficial',
            en: 'Visit Official Site',
            pt: 'Visitar Site Oficial',
            fr: 'Visiter le Site Officiel',
            de: 'Offizielle Seite Besuchen'
          },
          'view_dbpedia': {
            es: 'Ver en DBpedia',
            en: 'View on DBpedia',
            pt: 'Ver no DBpedia',
            fr: 'Voir sur DBpedia',
            de: 'Auf DBpedia Anzeigen'
          }
        };

        const lang = this.lang || options?.data?.root?.lang || 'es';
        return translations[key]?.[lang] || key;
      },
      
      // Helper para listar idiomas soportados
      supportedLanguages: function(options) {
        return Object.entries(supportedLangs)
          .map(([code, name]) => options.fn({ code, name, current: this.lang === code }))
          .join('');
      },
      
      // Helper para formatear fechas según idioma
      formatDate: function(dateStr) {
        const date = new Date(dateStr);
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        const lang = this.lang || 'es';
        
        return date.toLocaleDateString(lang, options);
      }
    }
  });

  // Configurar Handlebars como motor de plantillas
  app.engine('hbs', hbs.engine);
  app.set('view engine', 'hbs');
  app.set('views', path.join(__dirname, '../views'));

  // Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '../public')));
  
  // Middleware para establecer el idioma
  app.use((req, res, next) => {
    // Obtener idioma de query param, cookie o cabecera Accept-Language
    const lang = req.query.lang || 
                 req.cookies.lang || 
                 req.acceptsLanguages(Object.keys(supportedLangs)) || 
                 'es';
    
    // Validar que el idioma esté soportado
    req.lang = supportedLangs[lang] ? lang : 'es';
    
    // Establecer el idioma en res.locals para acceso en vistas
    res.locals.lang = req.lang;
    res.locals.supportedLangs = supportedLangs;
    
    // Establecer cookie de idioma
    res.cookie('lang', req.lang, { maxAge: 900000, httpOnly: true });
    
    next();
  });
};
