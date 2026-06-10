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
          'results_for': {
            es: 'Resultados para',
            en: 'Results for',
            pt: 'Resultados para',
            fr: 'Résultats pour',
            de: 'Ergebnisse für'
          },
          'back_home': {
            es: 'Volver al inicio',
            en: 'Back to home',
            pt: 'Voltar ao início',
            fr: 'Retour à l’accueil',
            de: 'Zur Startseite'
          },
          'error_title': {
            es: '¡Ups! Algo salió mal',
            en: 'Oops! Something went wrong',
            pt: 'Ops! Algo deu errado',
            fr: 'Oups ! Quelque chose s’est mal passé',
            de: 'Ups! Etwas ist schiefgelaufen'
          },
          'error_message_home': {
            es: 'Lo sentimos, para cambiar el idioma debes volver a la página de inicio.',
            en: 'Sorry, to change the language please return to the home page.',
            pt: 'Desculpe, para alterar o idioma volte à página inicial.',
            fr: 'Désolé, pour changer de langue veuillez revenir à la page d’accueil.',
            de: 'Entschuldigung, um die Sprache zu ändern, kehren Sie bitte zur Startseite zurück.'
          },
          'error_message_try_again': {
            es: 'Luego, realiza una nueva búsqueda para ver los resultados en el idioma seleccionado.',
            en: 'Then perform a new search to see results in the selected language.',
            pt: 'Em seguida, faça uma nova pesquisa para ver os resultados no idioma selecionado.',
            fr: 'Ensuite, effectuez une nouvelle recherche pour voir les résultats dans la langue sélectionnée.',
            de: 'Führen Sie dann eine neue Suche durch, um die Ergebnisse in der ausgewählten Sprache anzuzeigen.'
          },
          'error_suggestion_title': {
            es: 'Mientras tanto, puedes:',
            en: 'In the meantime, you can:',
            pt: 'Enquanto isso, você pode:',
            fr: 'En attendant, vous pouvez :',
            de: 'In der Zwischenzeit können Sie:'
          },
          'error_suggestion_refresh': {
            es: 'Intentar refrescar la página',
            en: 'Try refreshing the page',
            pt: 'Tentar atualizar a página',
            fr: 'Essayer d’actualiser la page',
            de: 'Versuchen Sie, die Seite zu aktualisieren'
          },
          'error_suggestion_connection': {
            es: 'Verificar tu conexión a internet',
            en: 'Check your internet connection',
            pt: 'Verificar sua conexão com a internet',
            fr: 'Vérifier votre connexion Internet',
            de: 'Überprüfen Sie Ihre Internetverbindung'
          },
          'error_suggestion_later': {
            es: 'Volver a intentar más tarde',
            en: 'Try again later',
            pt: 'Tente novamente mais tarde',
            fr: 'Réessayez plus tard',
            de: 'Versuchen Sie es später erneut'
          },
          'import_dbpedia': {
            es: 'Importar datos DBpedia (dev)',
            en: 'Import DBpedia data (dev)',
            pt: 'Importar dados DBpedia (dev)',
            fr: 'Importer les données DBpedia (dev)',
            de: 'DBpedia-Daten importieren (dev)'
          },
          'import_status_started': {
            es: 'Importación iniciada (pid',
            en: 'Import started (pid',
            pt: 'Importação iniciada (pid',
            fr: 'Importation démarrée (pid',
            de: 'Import gestartet (pid'
          },
          'import_status_error': {
            es: 'Error',
            en: 'Error',
            pt: 'Erro',
            fr: 'Erreur',
            de: 'Fehler'
          },
          'app_subtitle': {
            es: 'Motor semántico de becas con DBpedia',
            en: 'Semantic scholarship engine with DBpedia',
            pt: 'Motor semântico de bolsas com DBpedia',
            fr: 'Moteur sémantique de bourses avec DBpedia',
            de: 'Semantische Stipendiensuche mit DBpedia'
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
            de: 'Auf DBpedia anzeigen'
          },
          'featured_scholarships': {
            es: 'Becas Destacadas',
            en: 'Featured Scholarships',
            pt: 'Bolsas em Destaque',
            fr: 'Bourses en Vedette',
            de: 'Empfohlene Stipendien'
          },
          'hero_image_alt': {
            es: 'Explora información sobre becas',
            en: 'Explore scholarship information',
            pt: 'Explore informações sobre bolsas',
            fr: 'Explorez les informations sur les bourses',
            de: 'Entdecken Sie Informationen zu Stipendien'
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
