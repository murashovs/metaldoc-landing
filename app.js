const formatNumber = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const calc = {
  acts: document.querySelector("#actsRange"),
  manual: document.querySelector("#manualRange"),
  review: document.querySelector("#reviewRange"),
  days: document.querySelector("#daysRange"),
  hourRate: document.querySelector("#hourRateRange"),
  actsOut: document.querySelector("#actsOut"),
  manualOut: document.querySelector("#manualOut"),
  reviewOut: document.querySelector("#reviewOut"),
  daysOut: document.querySelector("#daysOut"),
  hourRateOut: document.querySelector("#hourRateOut"),
  moneySaved: document.querySelector("#moneySaved"),
  hoursSaved: document.querySelector("#hoursSaved"),
  daysSaved: document.querySelector("#daysSaved"),
  factorSaved: document.querySelector("#factorSaved"),
};

function updateCalculator() {
  const acts = Number(calc.acts.value);
  const manual = Number(calc.manual.value);
  const review = Number(calc.review.value);
  const days = Number(calc.days.value);
  const hourRate = Number(calc.hourRate.value);

  const manualHours = (acts * manual * days) / 60;
  const reviewHours = (acts * review * days) / 60;
  const savedHours = Math.max(manualHours - reviewHours, 0);
  const savedDays = savedHours / 8;
  const savedMoney = savedHours * hourRate;
  const factor = reviewHours > 0 ? manualHours / reviewHours : 0;

  calc.actsOut.textContent = formatNumber.format(acts);
  calc.manualOut.textContent = formatNumber.format(manual);
  calc.reviewOut.textContent = review.toFixed(1).replace(".", ",");
  calc.daysOut.textContent = formatNumber.format(days);
  calc.hourRateOut.textContent = `${formatNumber.format(hourRate)} ₽`;
  calc.moneySaved.textContent = `${formatNumber.format(savedMoney)} ₽/мес`;
  calc.hoursSaved.textContent = `${formatNumber.format(savedHours)} ч/мес`;
  calc.daysSaved.textContent = `${formatNumber.format(savedDays)} дней`;
  calc.factorSaved.textContent = `в ${factor.toFixed(1).replace(".", ",")} раза`;
}

["acts", "manual", "review", "days", "hourRate"].forEach((key) => {
  calc[key].addEventListener("input", updateCalculator);
});

updateCalculator();

const FORM_ENDPOINT = "https://formsubmit.co/ajax/doctormail@yandex.ru";

async function sendFormSubmit(data) {
  const response = await fetch(FORM_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === "false") {
    throw new Error(result.message || "Ошибка отправки");
  }

  return result;
}

const form = document.querySelector(".lead-form");
const formNote = document.querySelector("#formNote");

const initialButtonText = form.querySelector(".form-button span").textContent;

function setFormStatus(message, type) {
  formNote.textContent = message;
  formNote.classList.remove("success", "error");
  if (type) {
    formNote.classList.add(type);
  }
}

if (new URLSearchParams(window.location.search).get("sent") === "1") {
  setFormStatus("Заявка отправлена. Мы свяжемся, чтобы проверить распознавание на ваших актах.", "success");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.reportValidity()) {
    return;
  }

  const trap = form.querySelector('input[name="website"]');
  if (trap?.value) {
    return;
  }

  const button = form.querySelector(".form-button");
  const buttonText = button.querySelector("span");
  const data = Object.fromEntries(new FormData(form).entries());
  data.page = window.location.href;
  data.referrer = document.referrer || "не указан";
  data.site = "robotpsa.ru";

  button.disabled = true;
  buttonText.textContent = "Отправляем...";
  setFormStatus("Отправляем заявку на doctormail@yandex.ru.", null);

  try {
    await sendFormSubmit(data);
    form.reset();
    buttonText.textContent = "Заявка отправлена";
    setFormStatus(
      "Заявка отправлена. Мы свяжемся, чтобы проверить распознавание на ваших актах.",
      "success",
    );
    window.setTimeout(() => {
      buttonText.textContent = initialButtonText;
    }, 3200);
  } catch (error) {
    buttonText.textContent = initialButtonText;
    setFormStatus(
      "Не удалось отправить автоматически. Напишите напрямую на doctormail@yandex.ru.",
      "error",
    );
  } finally {
    button.disabled = false;
  }
});

const chat = document.querySelector("[data-chat]");
const chatOpen = document.querySelector("[data-chat-open]");
const chatClose = document.querySelector("[data-chat-close]");
const chatPanel = document.querySelector("[data-chat-panel]");
const chatMessages = document.querySelector("[data-chat-messages]");
const chatForm = document.querySelector("[data-chat-form]");
const chatNote = document.querySelector("[data-chat-note]");
const chatQuickButtons = document.querySelectorAll("[data-chat-quick]");

const chatReplies = {
  demo:
    "Отлично. Покажем распознавание на ваших ПСА и отдельно разберем загрузку в вашу 1С. Напишите телефон или Telegram прямо сюда, чтобы договориться о времени.",
  economy:
    "Экономия зависит от количества актов и времени ручного ввода. Напишите примерный объем ПСА в месяц, и я подскажу, что считать дальше.",
  "one-c":
    "Работа идет через обработку 1С: бухгалтер загружает сканы, проверяет спорные поля, затем создаются документы, движения и проводки. Если хотите, обсудим вашу конфигурацию.",
  acts:
    "Можно начать с небольшой пачки ваших приемо-сдаточных актов. По ним покажем качество распознавания и список полей на проверку. Напишите, сколько примерно актов в месяц.",
};

const chatLabels = {
  demo: "Хочу демо",
  economy: "Посчитать экономию",
  "one-c": "Как работает с 1С",
  acts: "Есть свои ПСА",
};

const chatTranscript = [
  {
    from: "Робот ПСА",
    text:
      "Напишите вопрос или оставьте телефон. Расскажем, как убрать ручной ввод приемо-сдаточных актов и загрузить данные в 1С.",
  },
];

const chatState = {
  contactAsked: false,
  sent: false,
};

function setChatStatus(message, type) {
  chatNote.textContent = message;
  chatNote.classList.remove("success", "error");
  if (type) {
    chatNote.classList.add(type);
  }
}

function renderChatMessage(text, from = "bot") {
  const message = document.createElement("div");
  message.className = `chat-message ${from}`;
  const content = document.createElement("span");
  content.textContent = text;
  message.append(content);
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addChatMessage(text, from = "bot") {
  const author = from === "user" ? "Посетитель" : "Робот ПСА";
  chatTranscript.push({ from: author, text });
  renderChatMessage(text, from);
}

function openChat() {
  chatPanel.hidden = false;
  chat.classList.add("is-open");
  chatOpen.setAttribute("aria-expanded", "true");
  window.setTimeout(() => {
    chatForm.querySelector("textarea")?.focus();
  }, 80);
}

function closeChat() {
  chatPanel.hidden = true;
  chat.classList.remove("is-open");
  chatOpen.setAttribute("aria-expanded", "false");
  chatOpen.focus();
}

function buildChatAutoReply(text) {
  const normalized = text.toLowerCase();

  if (hasContact(text)) {
    return "Спасибо, передал диалог. Свяжемся с вами и разберем ваши приемо-сдаточные акты.";
  }

  if (/(цен|стоим|тариф|сколько|руб)/.test(normalized)) {
    return "Стоимость зависит от объема ПСА и доработок под 1С. Быстрее всего оценить по вашей пачке актов и текущему процессу. Куда удобно написать или позвонить?";
  }

  if (/(1с|1c|провод|документ|движен|конфигурац)/.test(normalized)) {
    return chatReplies["one-c"];
  }

  if (/(демо|показ|презентац|созвон)/.test(normalized)) {
    return chatReplies.demo;
  }

  if (/(акт|пса|скан|паспорт|лом)/.test(normalized)) {
    return chatReplies.acts;
  }

  if (!chatState.contactAsked) {
    chatState.contactAsked = true;
    return "Понял. Чтобы не потерять вопрос, напишите телефон или Telegram прямо в чат — свяжемся и разберем ваш процесс.";
  }

  return "Принято. Добавил это в диалог. Если оставите телефон или Telegram, передам всю переписку для связи.";
}

function hasContact(text) {
  return /(\+?\d[\d\s().-]{8,}\d|@[a-zA-Z0-9_]{4,}|t\.me\/[a-zA-Z0-9_]+|[\w.+-]+@[\w-]+\.[\w.-]+)/.test(text);
}

function resizeChatTextarea() {
  const textarea = chatForm.querySelector("textarea");
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 118)}px`;
}

function buildChatPayload(contactMessage) {
  return {
    _subject: "Диалог из чата Робот ПСА",
    _template: "table",
    _captcha: "false",
    source: "robotpsa.ru chat",
    contact: contactMessage,
    page: window.location.href,
    referrer: document.referrer || "не указан",
    transcript: chatTranscript
      .map((entry) => `${entry.from}: ${entry.text}`)
      .join("\n"),
  };
}

chatOpen.setAttribute("aria-expanded", "false");
chatOpen.addEventListener("click", () => {
  if (chatPanel.hidden) {
    openChat();
  } else {
    closeChat();
  }
});

chatClose.addEventListener("click", closeChat);

chatQuickButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.chatQuick;
    const label = chatLabels[key] || button.textContent.trim();
    const reply = chatReplies[key];

    openChat();
    addChatMessage(label, "user");
    if (reply) {
      window.setTimeout(() => addChatMessage(reply, "bot"), 220);
    }

    if (key === "demo") {
      chatState.contactAsked = true;
      chatForm.querySelector("textarea")?.focus();
    }
  });
});

chatForm.querySelector("textarea").addEventListener("input", resizeChatTextarea);

chatForm.querySelector("textarea").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!chatForm.reportValidity()) {
    return;
  }

  const trap = chatForm.querySelector('input[name="website"]');
  if (trap?.value) {
    return;
  }

  const button = chatForm.querySelector(".chat-send");
  const data = Object.fromEntries(new FormData(chatForm).entries());
  const visitorMessage = data.message.trim();

  if (!visitorMessage) {
    return;
  }

  addChatMessage(visitorMessage, "user");
  chatForm.reset();
  resizeChatTextarea();

  const reply = buildChatAutoReply(visitorMessage);
  window.setTimeout(() => addChatMessage(reply, "bot"), 180);

  if (!hasContact(visitorMessage) || chatState.sent) {
    setChatStatus("Чат открыт. Можно продолжить диалог или оставить телефон/Telegram.", null);
    return;
  }

  button.disabled = true;
  setChatStatus("Передаю диалог на doctormail@yandex.ru.", null);

  try {
    await sendFormSubmit(buildChatPayload(visitorMessage));
    chatState.sent = true;
    setChatStatus("Диалог отправлен. Свяжемся с вами по указанному контакту.", "success");
  } catch (error) {
    setChatStatus("Не удалось отправить автоматически. Напишите напрямую на doctormail@yandex.ru.", "error");
  } finally {
    button.disabled = false;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !chatPanel.hidden) {
    closeChat();
  }
});

const header = document.querySelector("[data-elevate]");

function updateHeaderElevation() {
  header.style.boxShadow =
    window.scrollY > 20 ? "0 12px 30px rgba(22, 32, 39, 0.08)" : "none";
}

window.addEventListener("scroll", updateHeaderElevation, { passive: true });
updateHeaderElevation();

window.addEventListener("load", () => {
  if (window.lucide) {
    window.lucide.createIcons({
      attrs: {
        "aria-hidden": "true",
      },
    });
  }
});
