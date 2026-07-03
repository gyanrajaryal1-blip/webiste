const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const contactForm = document.querySelector(".contact-form");
const contactStatus = document.querySelector("#contactStatus");
const contactName = document.querySelector("#contactName");
const contactEmail = document.querySelector("#contactEmail");
const contactFromName = document.querySelector("#contactFromName");
const contactFromEmail = document.querySelector("#contactFromEmail");
const contactReplyTo = document.querySelector("#contactReplyTo");
const siteLoader = document.querySelector("#siteLoader");
const emailConfig = {
    publicKey: "4ns-qlYYXIv11gS4x",
    serviceId: "service_kh2ctto",
    templateId: "template_6m1kwvj"
};

document.body.classList.add("is-loading");

window.addEventListener("load", () => {
    window.setTimeout(() => {
        if (siteLoader) {
            siteLoader.classList.add("is-hidden");
        }
        document.body.classList.remove("is-loading");
    }, 900);
});

if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
        const isOpen = siteNav.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    siteNav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
            siteNav.classList.remove("is-open");
            navToggle.setAttribute("aria-expanded", "false");
        });
    });
}

if (contactForm) {
    if (window.emailjs && !emailConfig.publicKey.includes("PASTE_")) {
        emailjs.init({ publicKey: emailConfig.publicKey });
    }

    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!window.emailjs || emailConfig.publicKey.includes("PASTE_")) {
            contactStatus.textContent = "EmailJS public key is missing. Add it in js/main.js.";
            return;
        }

        contactStatus.textContent = "Sending message...";
        contactFromName.value = contactName.value;
        contactFromEmail.value = contactEmail.value;
        contactReplyTo.value = contactEmail.value;

        try {
            await emailjs.sendForm(emailConfig.serviceId, emailConfig.templateId, contactForm);
            contactForm.reset();
            contactStatus.textContent = "Message sent successfully.";
        } catch (error) {
            const detail = [error?.status, error?.text || error?.message].filter(Boolean).join(" ");
            contactStatus.textContent = `Could not send message. ${detail || "Please check EmailJS service, template, and public key."}`;
        }
    });
}
