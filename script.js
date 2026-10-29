// 한/영 화면 문구 전환. 경로: 첫 화면 > 한국어 / English
// 입력: URL ?lang=ko|en, localStorage "207studio-lang", navigator.language 순서로 시작 언어를 고른다(그 외 en).
// 출력: data-i18n(textContent), data-i18n-html(innerHTML), data-i18n-attr("속성:키;...") 요소의 문구, <html lang>,
//       data-lang-only 요소 표시 여부, 언어 전환 버튼 문구를 바꾸고 선택한 언어를 localStorage에 저장한다.
// MESSAGES는 JSON 문법을 지킨다(큰따옴표 키·값, 끝 쉼표 없음).
(function () {
  // 정적 한국어 페이지(/ko/)는 HTML에 한국어가 들어 있으므로 문구를 덮어쓰지 않는다.
  if (document.documentElement.getAttribute("lang") === "ko") return;
  var MESSAGES = {
    "en": {
      "meta.title": "207 Studio — Software, from the classroom.",
      "skip": "Skip to content",
      "nav.values": "Direction",
      "nav.work": "Our work",
      "nav.studio": "The studio",
      "nav.products": "Developer kits",
      "nav.writing": "Writing",
      "hero.eyebrow": "INDEPENDENT SOFTWARE STUDIO · SOUTH KOREA",
      "hero.title": "Software,<br>from the<br><span class=\"serif\">classroom.</span>",
      "hero.intro": "Thoughtful tools for the everyday work of teaching. Built by an elementary school teacher who knows that work firsthand.",
      "hero.cta": "See our work",
      "hero.products": "See the developer kits →",
      "panel.top": "207 / FIELD NOTES",
      "panel.prepare": "Prepare.",
      "panel.prepareText": "Turn materials into a lesson.",
      "panel.teach": "Teach.",
      "panel.teachText": "Keep the class in focus.",
      "panel.reflect": "Reflect.",
      "panel.reflectText": "Make assessment useful.",
      "panel.bottom": "SMALL STUDIO. PRACTICAL SOFTWARE.",
      "hero.stat1": "Teacher-led",
      "hero.stat2": "Classroom-focused",
      "hero.stat3": "Independently built",
      "values.eyebrow": "01 / VALUES & DIRECTION",
      "values.title": "Built by a teacher,<br><span class=\"serif\">for the work of teaching.</span>",
      "values.intro": "What we stand for, and where we are heading, in plain terms.",
      "v1.t": "Teacher-led",
      "v1.d": "Founded by an elementary school teacher in South Korea. Every tool starts from work that teacher knows firsthand.",
      "v2.t": "Practical first",
      "v2.d": "A small studio making practical software for preparing materials, teaching lessons and working through assessment.",
      "v3.t": "Independent",
      "v3.d": "Independently built, end to end. Our developer kits ship with full source.",
      "dir.title": "Where we are heading",
      "dir.intro": "We want to keep making software for teachers small, practical and in our own hands.",
      "dir.1.t": "Close to the classroom",
      "dir.1.d": "Keep building from work a teacher knows firsthand.",
      "dir.2.t": "Small and practical",
      "dir.2.d": "Stay a small studio making practical software.",
      "dir.3.t": "Independent, with source",
      "dir.3.d": "Keep building independently, end to end, with full source in our developer kits.",
      "work.eyebrow": "02 / OUR WORK",
      "work.title": "Four products,<br><span class=\"serif\">one studio.</span>",
      "work.intro": "Our work starts with the tasks teachers return to every day: presenting a lesson, working with materials, and understanding assessment.",
      "tab.chalk.sub": "Teach · iPad",
      "tag.dev": "In development",
      "tag.review": "In App Store review",
      "tab.checky.sub": "Assess · Python",
      "tab.stone.sub": "Game · iPhone & iPad",
      "tag.soon": "Coming soon",
      "pairy.name": "Pairy",
      "tab.pairy.sub": "Remote desktop",
      "tag.store": "On the App Store",
      "chalk.kicker": "CLASSROOM PRESENTATION · iPad",
      "chalk.lead": "Your teaching materials.<br>A more natural place to teach.",
      "chalk.desc": "An iPad app for classroom presentation and annotation, designed around the materials teachers already use.",
      "h.does": "What it does",
      "chalk.f1": "Work with PPTX, PDF, and HTML teaching materials",
      "chalk.f2": "Annotate while presenting a lesson",
      "chalk.f3": "Support teaching in English and Korean",
      "h.how": "How to use it",
      "chalk.s1t": "Bring your lesson material",
      "chalk.s1d": "Start from a PPTX, PDF or HTML file you already use.",
      "chalk.s2t": "Present it on your iPad",
      "chalk.s2d": "Show the material to your class.",
      "chalk.s3t": "Annotate as you teach",
      "chalk.s3d": "Mark up the material while you explain.",
      "chalk.link": "Chalkieboard support",
      "chalk.formats": "Works with",
      "checky.kicker": "ASSESSMENT · PYTHON",
      "checky.lead": "From setting questions<br>to seeing what comes next.",
      "checky.desc": "A Python-based application for exam authoring, grading, and analysis, bringing related assessment tasks into one workflow.",
      "checky.f1": "Create and organize exam content",
      "checky.f2": "Support the grading process",
      "checky.f3": "Analyze assessment results",
      "checky.label": "WORKFLOW CONCEPT · NOT AN APP SCREENSHOT",
      "checky.author": "Author",
      "checky.authorText": "Shape the assessment",
      "checky.grade": "Grade",
      "checky.gradeText": "Review the responses",
      "checky.analyze": "Analyze",
      "checky.analyzeText": "Inform the next lesson",
      "stone.kicker": "GAME · iPhone & iPad",
      "stone.lead": "Five in a row,<br>with stones that have character.",
      "stone.desc": "A five-in-a-row board game for iPhone and iPad, where every stone is a small character with its own look.",
      "stone.f1": "Classic five-in-a-row play",
      "stone.f2": "Stone characters with their own style",
      "stone.f3": "Built natively for iPhone and iPad",
      "stone.label": "IN DEVELOPMENT · ILLUSTRATION, NOT GAME FOOTAGE",
      "pairy.kicker": "REMOTE DESKTOP · iPhone & iPad",
      "pairy.former": "Formerly Padsway",
      "pairy.lead": "Your Mac,<br>on your iPad.",
      "pairy.desc": "A remote desktop app for using your Mac from your iPad. See your Mac’s screen and control it with touch, trackpad and keyboard.",
      "pairy.f1": "See your Mac’s screen on your iPad",
      "pairy.f2": "Control it with touch, trackpad and keyboard",
      "pairy.f3": "Try the built-in demo first, no Mac needed",
      "pairy.s1t": "Install Pairy on your Mac",
      "pairy.s1d": "Install and open Pairy for Mac, then allow Screen Recording and input permissions.",
      "pairy.s2t": "Sign in to the same Tailscale account",
      "pairy.s2d": "Use the same account on your Mac and your tablet so the two find each other.",
      "pairy.s3t": "Connect and take control",
      "pairy.s3d": "Pick your Mac from the list. Its screen appears and your tablet becomes its trackpad and keyboard.",
      "pairy.cta": "Get Pairy on the App Store",
      "work.availability": "Chalkieboard is in App Store review; CheckyBoard and StoneWars are under development. Features and availability may change; this page does not announce a public release.",
      "kits.title": "Looking for developer kits?",
      "kits.desc": "PPTX player, OMR grading, voice commands and Mac-to-iPad streaming, with the source included.",
      "kits.link": "Browse developer kits →",
      "studio.eyebrow": "03 / THE STUDIO",
      "studio.title": "Close to the work.<br><span class=\"serif\">Careful with the tools.</span>",
      "studio.lead": "207 Studio is an independent software studio founded by an elementary school teacher in South Korea.",
      "studio.body": "We build practical software around classroom work. That perspective shapes our focus: useful tools for preparing materials, teaching lessons, and working through assessments.",
      "facts.established": "Established",
      "facts.establishedValue": "September 2026",
      "facts.based": "Based in",
      "facts.basedValue": "South Korea",
      "facts.focus": "Focus",
      "facts.focusValue": "Teaching & productivity software",
      "contact.eyebrow": "05 / GET IN TOUCH",
      "contact.title": "Let’s talk.",
      "contact.text": "For company and product inquiries.",
      "contact.link": "Contact support",
      "footer.tagline": "Software for making and teaching.",
      "footer.support": "Support",
      "footer.privacy": "Privacy Policy",
      "footer.terms": "Terms of Use",
      "footer.refunds": "Refund Policy",
      "footer.copyright": "© 2026 207 Studio",
      "meta.description": "Independent, teacher-led software studio in South Korea making classroom tools and source-included developer kits.",
      "brand.home": "207 Studio home",
      "nav.label": "Main navigation",
      "panel.label": "Our focus: prepare, teach, reflect",
      "tabs.label": "Products",
      "stone.alt": "Illustration of five stones in a row on a board while shapes fall in the background",
      "footer.linksLabel": "Support and legal",
      "toggle.text": "한국어",
      "toggle.label": "한국어로 보기"
    },
    "ko": {
      "meta.title": "207스튜디오: 교실에서 시작하는 소프트웨어",
      "skip": "본문으로 건너뛰기",
      "nav.values": "방향",
      "nav.work": "작업",
      "nav.studio": "스튜디오",
      "nav.products": "개발자 키트",
      "nav.writing": "글",
      "hero.eyebrow": "독립 소프트웨어 스튜디오 · 대한민국",
      "hero.title": "교실에서<br>시작하는<br><span class=\"serif\">소프트웨어.</span>",
      "hero.intro": "가르치는 하루에 꼭 맞는 도구. 그 일을 직접 아는 초등학교 교사가 만들어요.",
      "hero.cta": "작업 보기",
      "hero.products": "개발자 키트 보기 →",
      "panel.top": "207 / 현장 노트",
      "panel.prepare": "준비.",
      "panel.prepareText": "자료를 수업으로 바꿔요.",
      "panel.teach": "수업.",
      "panel.teachText": "수업의 흐름을 놓치지 않게 해요.",
      "panel.reflect": "돌아보기.",
      "panel.reflectText": "평가를 쓸모 있게 만들어요.",
      "panel.bottom": "작은 스튜디오. 실용적인 소프트웨어.",
      "hero.stat1": "교사 주도",
      "hero.stat2": "교실 중심",
      "hero.stat3": "독립 개발",
      "values.eyebrow": "01 / 가치와 방향",
      "values.title": "교사가 만들어요,<br><span class=\"serif\">가르치는 일을 위해서.</span>",
      "values.intro": "저희가 일하는 방식이에요.",
      "v1.t": "교사가 이끌어요",
      "v1.d": "대한민국의 초등학교 교사가 설립했어요. 모든 도구는 그 일을 직접 아는 사람의 현장에서 출발해요.",
      "v2.t": "쓸모가 먼저예요",
      "v2.d": "작은 스튜디오가 자료 준비, 수업 진행, 평가 정리에 쓰는 실용적인 소프트웨어를 만들어요.",
      "v3.t": "독립적으로 만들어요",
      "v3.d": "처음부터 끝까지 직접 만들어요. 개발자 키트에는 소스가 모두 들어 있어요.",
      "dir.title": "우리가 가는 방향",
      "dir.intro": "교사를 위한 소프트웨어를 작고 쓸모 있게, 우리 손으로 계속 만들고 싶어요.",
      "dir.1.t": "교실 가까이에서",
      "dir.1.d": "교사가 직접 아는 현장의 일에서 계속 출발해요.",
      "dir.2.t": "작고 쓸모 있게",
      "dir.2.d": "작은 스튜디오로서 실용적인 소프트웨어를 계속 만들어요.",
      "dir.3.t": "독립적으로, 소스와 함께",
      "dir.3.d": "처음부터 끝까지 직접 만들고, 개발자 키트에는 소스를 모두 담아요.",
      "work.eyebrow": "02 / 작업",
      "work.title": "제품 네 가지,<br><span class=\"serif\">한 스튜디오에서.</span>",
      "work.intro": "교사가 날마다 하는 일에서 출발해요. 수업하고, 자료를 만지고, 평가 결과를 보는 일이요.",
      "tab.chalk.sub": "수업 · iPad",
      "tag.dev": "개발 중",
      "tag.review": "App Store 심사 중",
      "tab.checky.sub": "평가 · Python",
      "tab.stone.sub": "게임 · iPhone·iPad",
      "tag.soon": "출시 예정",
      "pairy.name": "Pairy(페어리)",
      "tab.pairy.sub": "원격 데스크톱",
      "tag.store": "App Store 출시",
      "chalk.kicker": "수업 진행 · iPad",
      "chalk.lead": "선생님의 수업 자료를<br>더 자연스럽게 펼치는 곳.",
      "chalk.desc": "선생님이 이미 쓰는 자료를 중심으로 설계한 iPad 수업·판서 앱이에요.",
      "h.does": "할 수 있는 일",
      "chalk.f1": "PPTX, PDF, HTML 수업 자료 사용",
      "chalk.f2": "수업하면서 바로 판서",
      "chalk.f3": "영어·한국어 수업 지원",
      "h.how": "이렇게 써요",
      "chalk.s1t": "수업 자료를 가져와요",
      "chalk.s1d": "이미 쓰고 있는 PPTX, PDF, HTML 파일에서 시작해요.",
      "chalk.s2t": "iPad로 띄워요",
      "chalk.s2d": "학생들에게 자료를 크게 보여 줘요.",
      "chalk.s3t": "설명하며 바로 판서해요",
      "chalk.s3d": "설명하면서 자료 위에 바로 써요.",
      "chalk.link": "Chalkieboard 지원 문의",
      "chalk.formats": "지원 자료",
      "checky.kicker": "평가 · Python",
      "checky.lead": "문제 출제부터<br>다음 수업 준비까지.",
      "checky.desc": "시험 출제, 채점, 분석을 하나의 흐름으로 묶는 Python 기반 프로그램이에요.",
      "checky.f1": "시험 문항 만들기와 정리",
      "checky.f2": "채점 과정 지원",
      "checky.f3": "평가 결과 분석",
      "checky.label": "작업 흐름 개념도 · 실제 앱 화면 아님",
      "checky.author": "출제",
      "checky.authorText": "평가를 설계해요",
      "checky.grade": "채점",
      "checky.gradeText": "답안을 검토해요",
      "checky.analyze": "분석",
      "checky.analyzeText": "다음 수업에 반영해요",
      "stone.kicker": "게임 · iPhone·iPad",
      "stone.lead": "다섯 개를 잇는 오목,<br>개성 있는 돌들과 함께.",
      "stone.desc": "iPhone과 iPad에서 즐기는 오목 게임이에요. 돌 하나하나가 저마다 모습을 가진 작은 캐릭터예요.",
      "stone.f1": "익숙한 오목 규칙",
      "stone.f2": "저마다 개성 있는 돌 캐릭터",
      "stone.f3": "iPhone·iPad 전용으로 제작",
      "stone.label": "개발 중 · 일러스트, 실제 게임 화면 아님",
      "pairy.kicker": "원격 데스크톱 · iPhone·iPad",
      "pairy.former": "예전 이름: Padsway",
      "pairy.lead": "내 Mac을,<br>iPad로.",
      "pairy.desc": "iPad로 내 Mac을 쓰는 원격 데스크톱 앱이에요. Mac 화면을 보면서 터치, 트랙패드, 키보드로 조작해요.",
      "pairy.f1": "Mac 화면을 iPad에서 보기",
      "pairy.f2": "터치, 트랙패드, 키보드로 조작",
      "pairy.f3": "Mac 없이 내장 데모로 먼저 체험",
      "pairy.s1t": "Mac에 Pairy를 설치해요",
      "pairy.s1d": "Pairy for Mac을 설치해 열고, 화면 기록과 입력 권한을 허용해요.",
      "pairy.s2t": "같은 Tailscale 계정으로 로그인해요",
      "pairy.s2d": "Mac과 태블릿에서 같은 계정으로 로그인하면 두 기기가 서로를 찾아요.",
      "pairy.s3t": "연결하고 조작해요",
      "pairy.s3d": "목록에서 Mac을 고르면 화면이 나타나고, 태블릿이 트랙패드와 키보드가 돼요.",
      "pairy.cta": "App Store에서 Pairy 받기",
      "work.availability": "Chalkieboard는 App Store 심사 중이고, CheckyBoard와 StoneWars는 개발 중이에요. 기능과 출시 일정은 바뀔 수 있고, 이 페이지는 정식 출시 안내가 아니에요.",
      "kits.title": "개발자 키트를 찾으세요?",
      "kits.desc": "PPTX 플레이어, OMR 채점, 음성 명령, Mac 화면을 iPad로 스트리밍까지 담았어요. 소스도 함께 드려요.",
      "kits.link": "개발자 키트 보기 →",
      "studio.eyebrow": "03 / 스튜디오",
      "studio.title": "교실 가까이에서,<br><span class=\"serif\">신중하게 만들어요.</span>",
      "studio.lead": "207스튜디오는 대한민국의 초등학교 교사가 설립한 독립 소프트웨어 스튜디오입니다.",
      "studio.body": "자료 준비, 수업, 평가 정리에 바로 쓰이는 도구를 만들어요.",
      "facts.established": "설립",
      "facts.establishedValue": "2026년 9월",
      "facts.based": "소재지",
      "facts.basedValue": "대한민국",
      "facts.focus": "분야",
      "facts.focusValue": "수업·생산성 소프트웨어",
      "contact.eyebrow": "04 / 문의",
      "contact.title": "문의하기",
      "contact.text": "회사와 제품에 관한 문의를 받습니다.",
      "contact.link": "지원 문의",
      "footer.tagline": "가르치는 일을 위한 소프트웨어.",
      "footer.support": "지원",
      "footer.privacy": "개인정보 처리방침",
      "footer.terms": "이용약관",
      "footer.refunds": "환불 정책",
      "footer.copyright": "© 2026 207스튜디오",
      "meta.description": "207스튜디오는 대한민국의 초등학교 교사가 설립한 독립 소프트웨어 스튜디오입니다. 수업 준비와 판서, 평가에 쓰는 실용적인 도구와 오목 게임 StoneWars를 만듭니다.",
      "brand.home": "207 Studio 홈",
      "nav.label": "주 메뉴",
      "panel.label": "우리가 집중하는 일: 준비, 수업, 돌아보기",
      "tabs.label": "제품",
      "stone.alt": "배경에서 도형들이 떨어지는 가운데 바둑판 위에 돌 다섯 개가 한 줄로 놓인 일러스트",
      "footer.linksLabel": "지원 및 법적 고지",
      "toggle.text": "English",
      "toggle.label": "View in English"
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
