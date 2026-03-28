const revealNodes = document.querySelectorAll(
  ".hero-copy, .hero-art, .highlights article, .section-heading, .product-card, .story-card, .commission-card, .testimonial-grid article, .contact-section"
);

revealNodes.forEach((node) => {
  node.setAttribute("data-reveal", "");
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.18,
    rootMargin: "0px 0px -40px 0px",
  }
);

revealNodes.forEach((node) => observer.observe(node));

const form = document.querySelector(".contact-form");

form?.addEventListener("submit", (event) => {
  event.preventDefault();

  const button = form.querySelector("button");
  if (!button) return;

  const originalLabel = button.textContent;
  button.textContent = "Inquiry sent";
  button.disabled = true;

  setTimeout(() => {
    button.textContent = originalLabel;
    button.disabled = false;
  }, 2200);
});
