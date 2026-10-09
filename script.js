// 한/영 화면 문구 전환. 경로: 첫 화면 > 한국어 / English
// 입력: URL ?lang=ko|en, localStorage "207studio-lang", navigator.language 순서로 시작 언어를 고른다(그 외 en).
// 출력: data-i18n(textContent), data-i18n-html(innerHTML), data-i18n-attr("속성:키;...") 요소의 문구, <html lang>,
//       data-lang-only 요소 표시 여부, 언어 전환 버튼 문구를 바꾸고 선택한 언어를 localStorage에 저장한다.
// MESSAGES는 JSON 문법을 지킨다(큰따옴표 키·값, 끝 쉼표 없음).
(function () {
  var MESSAGES = {
    "en": {
      "meta.title": "207 Studio — Software, from the classroom.",
      "meta.description": "207 Studio is an independent, teacher-led software studio in South Korea. We develop practical tools for teaching, classroom presentation, and assessment, along with the five-in-a-row game StoneWars.",
      "skip": "Skip to content",
      "brand.home": "207 Studio home",
      "nav.label": "Main navigation",
      "nav.work": "Our work",
      "nav.studio": "The studio",
      "toggle.text": "한국어",
      "toggle.label": "한국어로 보기",
      "hero.eyebrow": "INDEPENDENT SOFTWARE STUDIO · SOUTH KOREA",
      "hero.title": "Software,<br>from the<br><span class=\"serif\">classroom.</span>",
      "hero.intro": "Thoughtful tools for the everyday work of teaching. Built by an elementary school teacher who knows that work firsthand.",
      "hero.cta": "Explore our work",
      "panel.label": "Our focus: prepare, teach, reflect",
      "panel.top": "207 / FIELD NOTES",
      "panel.prepare": "Prepare.",
      "panel.prepareText": "Turn materials into a lesson.",
      "panel.teach": "Teach.",
      "panel.teachText": "Keep the class in focus.",
      "panel.reflect": "Reflect.",
      "panel.reflectText": "Make assessment useful.",
      "panel.bottom": "SMALL STUDIO. PRACTICAL SOFTWARE.",
      "band.teacher": "Teacher-led",
      "band.classroom": "Classroom-focused",
      "band.independent": "Independently built",
      "work.eyebrow": "01 / OUR WORK",
      "work.title": "Tools with a<br><span class=\"serif\">clear purpose.</span>",
      "work.intro": "Our development work starts with the tasks teachers return to every day: presenting a lesson, working with materials, and understanding assessment.",
      "tag.dev": "In development",
      "concept.label": "WORKFLOW CONCEPT · NOT AN APP SCREENSHOT",
      "chalk.kicker": "01 / CLASSROOM PRESENTATION",
      "chalk.lead": "Your teaching materials.<br>A more natural place to teach.",
      "chalk.desc": "An iPad app for classroom presentation and annotation, designed around the materials teachers already use.",
      "chalk.f1": "Work with PPTX, PDF, and HTML teaching materials",
      "chalk.f2": "Annotate while presenting a lesson",
      "chalk.f3": "Support teaching in English and Korean",
      "chalk.link": "Chalkieboard support & information",
      "chalk.flow": "Materials → Lesson",
      "chalk.sample": "One idea.<br>Room to explain.",
      "chalk.present": "Present",
      "chalk.annotate": "Annotate",
      "chalk.teach": "Teach",
      "checky.kicker": "02 / ASSESSMENT",
      "checky.lead": "From setting questions<br>to seeing what comes next.",
      "checky.desc": "A Python-based application for exam authoring, grading, and analysis, bringing related assessment tasks into one workflow.",
      "checky.f1": "Create and organize exam content",
      "checky.f2": "Support the grading process",
      "checky.f3": "Analyze assessment results",
      "checky.author": "Author",
      "checky.authorText": "Shape the assessment",
      "checky.grade": "Grade",
      "checky.gradeText": "Review the responses",
      "checky.analyze": "Analyze",
      "checky.analyzeText": "Inform the next lesson",
      "tag.soon": "Coming soon",
      "stonewars.kicker": "03 / GAME",
      "stonewars.name": "StoneWars",
      "stonewars.lead": "Five in a row,<br>with stones that have character.",
      "stonewars.desc": "A five-in-a-row board game for iPhone and iPad, where every stone is a small character with its own look.",
      "stonewars.f1": "Classic five-in-a-row play",
      "stonewars.f2": "Stone characters with their own style",
      "stonewars.f3": "Built natively for iPhone and iPad",
      "stonewars.label": "IN DEVELOPMENT · STONE PREVIEW",
      "stonewars.alt": "A StoneWars stone character falling through the sky among clouds",
      "work.availability": "These projects are under development. Features and availability may change; this page does not announce a public release.",
      "other.eyebrow": "BEYOND THE CLASSROOM",
      "other.desc": "Our software work also includes a Mac–iPad remote connection project, exploring more flexible ways to work across devices.",
      "studio.eyebrow": "02 / THE STUDIO",
      "studio.title": "Close to the work.<br><span class=\"serif\">Careful with the tools.</span>",
      "studio.lead": "207 Studio is an independent software studio founded by an elementary school teacher in South Korea.",
      "studio.body": "We build practical software around classroom work. That perspective shapes our focus: useful tools for preparing materials, teaching lessons, and working through assessments.",
      "facts.established": "Established",
      "facts.establishedValue": "September 2026",
      "facts.based": "Based in",
      "facts.basedValue": "South Korea",
      "facts.focus": "Focus",
      "facts.focusValue": "Teaching & productivity software",
      "contact.eyebrow": "04 / GET IN TOUCH",
      "contact.title": "Let’s talk.",
      "contact.text": "For company and product inquiries.",
      "contact.link": "Contact support",
      "footer.tagline": "Software for making and teaching.",
      "footer.linksLabel": "Support and legal",
      "footer.support": "Support",
      "footer.privacy": "Privacy Policy",
      "footer.terms": "Terms of Use",
      "footer.copyright": "© 2026 207 Studio"
    },
    "ko": {
      "meta.title": "207스튜디오 — 교실에서 시작하는 소프트웨어",
      "meta.description": "207스튜디오는 대한민국의 초등학교 교사가 설립한 독립 소프트웨어 스튜디오입니다. 수업 준비와 판서, 평가에 쓰는 실용적인 도구와 오목 게임 스톤워즈를 만듭니다.",
      "skip": "본문으로 건너뛰기",
      "brand.home": "207스튜디오 홈",
      "nav.label": "주 메뉴",
      "nav.work": "제품",
      "nav.studio": "스튜디오",
      "toggle.text": "English",
      "toggle.label": "View in English",
      "hero.eyebrow": "독립 소프트웨어 스튜디오 · 대한민국",
      "hero.title": "교실에서<br>시작하는<br><span class=\"serif\">소프트웨어.</span>",
      "hero.intro": "가르치는 일상을 위한 세심한 도구. 그 일을 직접 아는 초등학교 교사가 만듭니다.",
      "hero.cta": "제품 보기",
      "panel.label": "우리가 집중하는 일: 준비, 수업, 돌아보기",
      "panel.top": "207 / 현장 노트",
      "panel.prepare": "준비.",
      "panel.prepareText": "자료를 수업으로 바꿉니다.",
      "panel.teach": "수업.",
      "panel.teachText": "수업의 흐름을 놓치지 않게 합니다.",
      "panel.reflect": "돌아보기.",
      "panel.reflectText": "평가를 쓸모 있게 만듭니다.",
      "panel.bottom": "작은 스튜디오. 실용적인 소프트웨어.",
      "band.teacher": "교사 주도",
      "band.classroom": "교실 중심",
      "band.independent": "독립 개발",
      "work.eyebrow": "01 / 제품",
      "work.title": "쓰임이 분명한<br><span class=\"serif\">도구.</span>",
      "work.intro": "교사가 매일 다시 마주하는 일에서 개발을 시작합니다. 수업을 진행하고, 자료를 다루고, 평가 결과를 살피는 일입니다.",
      "tag.dev": "개발 중",
      "concept.label": "작업 흐름 개념도 · 실제 앱 화면 아님",
      "chalk.kicker": "01 / 수업 진행",
      "chalk.lead": "선생님의 수업 자료를<br>더 자연스럽게 펼치는 곳.",
      "chalk.desc": "선생님이 이미 쓰는 자료를 중심으로 설계한 아이패드 수업·판서 앱입니다.",
      "chalk.f1": "PPTX, PDF, HTML 수업 자료 사용",
      "chalk.f2": "수업하면서 바로 판서",
      "chalk.f3": "영어·한국어 수업 지원",
      "chalk.link": "Chalkieboard 지원 및 정보",
      "chalk.flow": "자료 → 수업",
      "chalk.sample": "하나의 생각.<br>설명할 여유.",
      "chalk.present": "발표",
      "chalk.annotate": "판서",
      "chalk.teach": "수업",
      "checky.kicker": "02 / 평가",
      "checky.lead": "문제 출제부터<br>다음 수업 준비까지.",
      "checky.desc": "시험 출제, 채점, 분석을 하나의 흐름으로 묶는 Python 기반 프로그램입니다.",
      "checky.f1": "시험 문항 만들기와 정리",
      "checky.f2": "채점 과정 지원",
      "checky.f3": "평가 결과 분석",
      "checky.author": "출제",
      "checky.authorText": "평가를 설계합니다",
      "checky.grade": "채점",
      "checky.gradeText": "답안을 검토합니다",
      "checky.analyze": "분석",
      "checky.analyzeText": "다음 수업에 반영합니다",
      "tag.soon": "출시 예정",
      "stonewars.kicker": "03 / 게임",
      "stonewars.name": "스톤워즈",
      "stonewars.lead": "다섯 개를 잇는 오목,<br>개성 있는 돌들과 함께.",
      "stonewars.desc": "아이폰과 아이패드에서 즐기는 오목 게임입니다. 돌 하나하나가 저마다 모습을 가진 작은 캐릭터입니다.",
      "stonewars.f1": "익숙한 오목 규칙",
      "stonewars.f2": "저마다 개성 있는 돌 캐릭터",
      "stonewars.f3": "아이폰·아이패드 전용으로 제작",
      "stonewars.label": "개발 중 · 스톤 미리보기",
      "stonewars.alt": "구름 사이 하늘에서 떨어지는 스톤워즈 돌 캐릭터",
      "work.availability": "스톤워즈를 포함해 모두 개발 중인 프로젝트입니다. 기능과 출시 일정은 바뀔 수 있으며, 이 페이지는 정식 출시 안내가 아닙니다.",
      "other.eyebrow": "교실 밖의 작업",
      "other.desc": "Mac과 iPad를 원격으로 잇는 프로젝트도 진행하고 있습니다. 여러 기기를 오가며 더 유연하게 일하는 방법을 찾습니다.",
      "studio.eyebrow": "02 / 스튜디오",
      "studio.title": "현장 가까이에서.<br><span class=\"serif\">도구는 신중하게.</span>",
      "studio.lead": "207스튜디오는 대한민국의 초등학교 교사가 설립한 독립 소프트웨어 스튜디오입니다.",
      "studio.body": "교실의 일을 중심으로 실용적인 소프트웨어를 만듭니다. 그래서 자료 준비, 수업 진행, 평가 정리에 쓸모 있는 도구에 집중합니다.",
      "facts.established": "설립",
      "facts.establishedValue": "2026년 9월",
      "facts.based": "소재지",
      "facts.basedValue": "대한민국",
      "facts.focus": "분야",
      "facts.focusValue": "수업·생산성 소프트웨어",
      "contact.eyebrow": "03 / 문의",
      "contact.title": "문의하기",
      "contact.text": "회사와 제품에 관한 문의를 받습니다.",
      "contact.link": "지원 페이지로 이동",
      "footer.tagline": "만들고 가르치는 일을 위한 소프트웨어.",
      "footer.linksLabel": "지원 및 법적 고지",
      "footer.support": "지원",
      "footer.privacy": "개인정보 처리방침",
      "footer.terms": "이용약관",
      "footer.copyright": "© 2026 207스튜디오"
    }
  };
  var STORAGE_KEY = "207studio-lang";
  var root = document.documentElement;

  function isSupported(lang) {
    return lang === "en" || lang === "ko";
  }

  function readStored() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function writeStored(lang) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
  }

  // URL의 lang 값을 소문자로 돌려준다. 없거나 디코딩·읽기에 실패하면 null.
  function readQuery() {
    try {
      var match = /[?&]lang=([^&#]*)/.exec(window.location.search);
      return match ? decodeURIComponent(match[1]).toLowerCase() : null;
    } catch (e) {
      return null;
    }
  }

  // 브라우저 언어가 ko로 시작하면 "ko", 그 밖이나 읽기 실패 시 "en".
  function navigatorLang() {
    try {
      var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "";
      return String(nav).toLowerCase().indexOf("ko") === 0 ? "ko" : "en";
    } catch (e) {
      return "en";
    }
  }

  function initialLang() {
    var fromQuery = readQuery();
    if (isSupported(fromQuery)) return fromQuery;
    var stored = readStored();
    if (isSupported(stored)) return stored;
    return navigatorLang();
  }

  function each(selector, fn) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) fn(nodes[i]);
  }

  function apply(lang) {
    var dict = MESSAGES[lang];
    root.lang = lang;
    each("[data-i18n]", function (el) {
      var value = dict[el.getAttribute("data-i18n")];
      if (value !== undefined) el.textContent = value;
    });
    each("[data-i18n-html]", function (el) {
      var value = dict[el.getAttribute("data-i18n-html")];
      if (value !== undefined) el.innerHTML = value;
    });
    each("[data-i18n-attr]", function (el) {
      var pairs = el.getAttribute("data-i18n-attr").split(";");
      for (var i = 0; i < pairs.length; i++) {
        var parts = pairs[i].split(":");
        var value = dict[parts[1]];
        if (parts.length === 2 && value !== undefined) el.setAttribute(parts[0], value);
      }
    });
    each("[data-lang-only]", function (el) {
      el.hidden = el.getAttribute("data-lang-only") !== lang;
    });
    each("[data-lang-toggle]", function (el) {
      el.textContent = dict["toggle.text"];
      el.setAttribute("aria-label", dict["toggle.label"]);
      el.lang = lang === "ko" ? "en" : "ko";
      el.hidden = false;
    });
  }

  function syncQuery(lang) {
    try {
      if (!/[?&]lang=/.test(window.location.search) || !window.history || !window.history.replaceState) return;
      var search = window.location.search.replace(/([?&]lang=)[^&#]*/, "$1" + lang);
      window.history.replaceState(null, "", search + window.location.hash);
    } catch (e) {}
  }

  var current = initialLang();
  apply(current);

  each("[data-lang-toggle]", function (el) {
    el.addEventListener("click", function () {
      current = current === "ko" ? "en" : "ko";
      apply(current);
      writeStored(current);
      syncQuery(current);
    });
  });
})();
