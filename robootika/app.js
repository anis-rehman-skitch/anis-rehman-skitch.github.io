(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const whatsappNumber = '971545258048';
  const whatsappUrl = message => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  const genericEnquiry = 'Hello Robootika! I would like to learn more about your training programmes, partnerships and robotics kits.';
  const visible = element => Boolean(element?.isConnected && element.getClientRects().length);
  const focus = element => { if (visible(element)) element.focus({ preventScroll: true }); };
  const menu = $('#menu-toggle');
  const navigation = $('#main-navigation');

  function closeMenu(restoreFocus = true) {
    if (!menu || !navigation) return;
    const focusedInside = navigation.classList.contains('open') && navigation.contains(document.activeElement);
    navigation.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Open navigation');
    if (restoreFocus && focusedInside) focus(menu);
  }

  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    navigation?.classList.toggle('open', open);
  });
  if (navigation) $$('a', navigation).forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
  });
  document.addEventListener('click', event => {
    if (!navigation?.contains(event.target) && !menu?.contains(event.target)) closeMenu();
  });
  window.addEventListener('resize', () => {
    // The CSS controls the breakpoint; a hidden menu button means desktop navigation.
    if (menu && !visible(menu)) closeMenu(false);
  });

  function initializeFilters(buttonSelector, cardSelector, countSelector, allValue, match, noun) {
    const buttons = $$(buttonSelector);
    const cards = $$(cardSelector);
    const count = $(countSelector);
    if (!buttons.length) return;
    const filterKey = buttonSelector.slice(6, -1).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    function applyFilter(value) {
      let shown = 0;
      buttons.forEach(button => {
        const selected = button.dataset[filterKey] === value;
        button.setAttribute('aria-pressed', String(selected));
        button.classList.toggle('active', selected);
      });
      cards.forEach(card => {
        const show = value === allValue || match(card, value);
        card.hidden = !show;
        if (show) shown += 1;
      });
      if (count) count.textContent = `${shown} ${noun}${shown === 1 ? '' : 's'} shown`;
    }
    buttons.forEach(button => {
      button.type = 'button';
      button.addEventListener('click', () => applyFilter(button.dataset[filterKey]));
    });
    const initial = buttons.find(button => button.getAttribute('aria-pressed') === 'true') || buttons[0];
    applyFilter(initial?.dataset[filterKey] || allValue);
  }

  initializeFilters(
    '[data-program-filter]', '[data-program-card]', '#program-count', 'all',
    (card, value) => (card.dataset.audiences || '').split(/\s+/).includes(value), 'programme'
  );
  initializeFilters(
    '[data-project-filter]', '[data-project-card]', '#project-count', 'All',
    (card, value) => card.dataset.category === value, 'project'
  );
  initializeFilters(
    '[data-gallery-filter]', '[data-gallery-card]', '#gallery-count', 'All',
    (card, value) => card.dataset.category === value, 'photograph'
  );

  $$('[data-whatsapp]').forEach(link => {
    link.href = whatsappUrl(link.dataset.message?.trim() || genericEnquiry);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
  if ($('#year')) $('#year').textContent = String(new Date().getFullYear());

  const privacyDialog = $('#privacy-dialog');
  const privacyButton = $('#privacy-button');
  let privacyReturnTarget = null;
  privacyButton?.addEventListener('click', () => {
    if (!privacyDialog || privacyDialog.open) return;
    privacyReturnTarget = navigation?.classList.contains('open') && navigation.contains(document.activeElement)
      ? menu : document.activeElement;
    closeMenu(false);
    privacyDialog.showModal();
    document.body.classList.add('body-dialog-open');
    privacyDialog.scrollTop = 0;
    focus($('[data-close-dialog]', privacyDialog));
  });
  if (privacyDialog) {
    $$('[data-close-dialog]', privacyDialog).forEach(button => {
      button.type = 'button';
      button.addEventListener('click', () => privacyDialog.close());
    });
    privacyDialog.addEventListener('click', event => {
      if (event.target !== privacyDialog) return;
      const box = privacyDialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) privacyDialog.close();
    });
    privacyDialog.addEventListener('close', () => {
      if (!$('dialog[open]')) document.body.classList.remove('body-dialog-open');
      focus(visible(privacyReturnTarget) ? privacyReturnTarget : privacyButton);
      privacyReturnTarget = null;
    });
  }

  const galleryDialog = $('#gallery-dialog');
  const galleryImage = $('#gallery-image');
  const galleryCaption = $('#gallery-caption');
  const galleryCounter = $('#gallery-counter');
  const galleryPrevious = $('#gallery-prev');
  const galleryNext = $('#gallery-next');
  const galleryThumbnails = $$('[data-gallery-open]');
  let galleryItems = [];
  let galleryIndex = 0;
  let galleryReturnTarget = null;

  function availablePhotographs() {
    return galleryThumbnails.filter(thumbnail => {
      const card = thumbnail.closest('[data-gallery-card]');
      return thumbnail.dataset.full && !thumbnail.hidden && (!card || !card.hidden);
    });
  }

  function renderPhotograph() {
    const thumbnail = galleryItems[galleryIndex];
    if (!thumbnail || !galleryDialog || !galleryImage) return;
    const caption = thumbnail.dataset.caption || thumbnail.dataset.alt || 'Robootika learning gallery';
    galleryDialog.classList.add('is-loading');
    galleryImage.setAttribute('aria-busy', 'true');
    galleryImage.alt = thumbnail.dataset.alt || caption;
    if (galleryCaption) galleryCaption.textContent = caption;
    if (galleryCounter) galleryCounter.textContent = `${galleryIndex + 1} of ${galleryItems.length}`;
    if (galleryPrevious) galleryPrevious.disabled = galleryItems.length <= 1;
    if (galleryNext) galleryNext.disabled = galleryItems.length <= 1;
    galleryImage.onload = () => {
      galleryDialog.classList.remove('is-loading');
      galleryImage.setAttribute('aria-busy', 'false');
    };
    galleryImage.onerror = () => {
      galleryDialog.classList.remove('is-loading');
      galleryImage.setAttribute('aria-busy', 'false');
      if (galleryCaption) galleryCaption.textContent = `${caption} — This photograph could not load. You can try another photograph or close the gallery.`;
    };
    galleryImage.src = thumbnail.dataset.full;
    // Cached images may already be complete before a new load event is observed.
    if (galleryImage.complete && galleryImage.naturalWidth > 0) galleryImage.onload();
  }

  function movePhotograph(direction) {
    const current = galleryItems[galleryIndex];
    galleryItems = availablePhotographs();
    if (!galleryItems.length) {
      galleryDialog?.close();
      return;
    }
    const currentIndex = galleryItems.indexOf(current);
    galleryIndex = currentIndex < 0 ? 0 : (currentIndex + direction + galleryItems.length) % galleryItems.length;
    renderPhotograph();
  }

  if (galleryDialog && galleryImage) {
    galleryThumbnails.forEach(thumbnail => {
      thumbnail.type = 'button';
      thumbnail.addEventListener('click', () => {
        galleryItems = availablePhotographs();
        galleryIndex = galleryItems.indexOf(thumbnail);
        if (galleryIndex < 0) return;
        galleryReturnTarget = thumbnail;
        closeMenu(false);
        renderPhotograph();
        if (!galleryDialog.open) galleryDialog.showModal();
        document.body.classList.add('body-dialog-open');
        focus($('[data-gallery-close]', galleryDialog));
      });
    });
    if (galleryCounter) {
      galleryCounter.setAttribute('aria-live', 'polite');
      galleryCounter.setAttribute('aria-atomic', 'true');
    }
    [[galleryPrevious, -1, 'Previous photograph'], [galleryNext, 1, 'Next photograph']].forEach(([button, direction, label]) => {
      if (!button) return;
      button.type = 'button';
      button.setAttribute('aria-label', label);
      button.addEventListener('click', () => movePhotograph(direction));
    });
    $$('[data-gallery-close]', galleryDialog).forEach(button => {
      button.type = 'button';
      button.addEventListener('click', () => galleryDialog.close());
    });
    galleryDialog.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      if (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
      event.preventDefault();
      movePhotograph(event.key === 'ArrowLeft' ? -1 : 1);
    });
    galleryDialog.addEventListener('click', event => {
      if (event.target === galleryDialog) galleryDialog.close();
    });
    galleryDialog.addEventListener('close', () => {
      if (!$('dialog[open]')) document.body.classList.remove('body-dialog-open');
      galleryDialog.classList.remove('is-loading');
      galleryImage.setAttribute('aria-busy', 'false');
      focus(visible(galleryReturnTarget) ? galleryReturnTarget : $('[data-gallery-filter][aria-pressed="true"]'));
      galleryReturnTarget = null;
    });
  }

  const form = $('#contact-form');
  const status = $('#contact-status');
  const fallback = $('#whatsapp-fallback');
  const field = name => form?.elements.namedItem(name);
  const value = name => (field(name)?.value || '').trim();
  let draftPrepared = false;

  function invalidateDraft() {
    if (!draftPrepared) return;
    draftPrepared = false;
    if (fallback) fallback.hidden = true;
    if (status) status.textContent = 'Your enquiry has changed. Prepare a new WhatsApp draft before sending it.';
  }

  function selectValue(name, requested) {
    const select = field(name);
    if (!select || !requested || !select.options) return;
    if ([...select.options].some(option => option.value === requested)) {
      select.value = requested;
      select.setCustomValidity('');
      invalidateDraft();
    }
  }

  $$('[data-enquiry], [data-request]').forEach(link => {
    link.href = '#contact';
    link.addEventListener('click', () => {
      selectValue('request', link.dataset.request || 'Program enquiry');
      selectValue('interest', link.dataset.enquiry);
      selectValue('role', link.dataset.role);
      closeMenu();
    });
  });

  if (!form) return;
  if (status) {
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
  }
  if (fallback) {
    fallback.hidden = true;
    fallback.target = '_blank';
    fallback.rel = 'noopener noreferrer';
  }

  function validateField(control) {
    if (!control || typeof control.setCustomValidity !== 'function') return;
    control.setCustomValidity('');
    if (control.disabled || control.type === 'submit' || control.type === 'button') return;
    const trimmed = String(control.value || '').trim();
    if (control.required && !trimmed) {
      control.setCustomValidity('Please complete this field.');
    } else if (trimmed && control.minLength > 0 && trimmed.length < control.minLength) {
      control.setCustomValidity(`Please enter at least ${control.minLength} characters.`);
    } else if (control.name === 'students' && trimmed) {
      const students = Number(trimmed);
      if (!Number.isInteger(students) || students < 1 || students > 5000) {
        control.setCustomValidity('Enter a whole number of students between 1 and 5000, or leave this field blank.');
      }
    }
  }

  [...form.elements].forEach(control => {
    control.addEventListener('input', () => { validateField(control); invalidateDraft(); });
    control.addEventListener('change', () => { validateField(control); invalidateDraft(); });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    [...form.elements].forEach(validateField);
    if (!form.reportValidity()) return;

    const selectLabel = name => {
      const control = field(name);
      const option = control?.selectedOptions?.[0];
      return option ? option.textContent.trim() : value(name);
    };
    const message = [
      'Hello Robootika! I would like to discuss an enquiry.',
      '',
      `Request: ${selectLabel('request') || 'Program enquiry'}`,
      `Name: ${value('name')}`,
      `Email: ${value('email')}`,
      value('phone') ? `Phone: ${value('phone')}` : '',
      value('organization') ? `Organisation: ${value('organization')}` : '',
      value('role') ? `Enquiry from: ${selectLabel('role')}` : '',
      value('interest') ? `Interested in: ${selectLabel('interest')}` : '',
      value('students') ? `Number of students: ${value('students')}` : '',
      '',
      value('message') ? `Requirements / message:\n${value('message')}` : '',
      '',
      'Please share the relevant options, availability and next steps.'
    ].filter((line, index, lines) => line || (index > 0 && lines[index - 1])).join('\n');
    const url = whatsappUrl(message);
    if (fallback) {
      fallback.href = url;
      fallback.hidden = false;
    }
    draftPrepared = true;
    if (status) status.textContent = 'Your WhatsApp draft is ready. Review it in WhatsApp and press Send when you are ready. Nothing has been sent by this website. If WhatsApp did not open, use the link below.';
    // Keep the handoff inside the submit gesture. A fallback remains available if blocked.
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (_) {
      if (status) status.textContent = 'Your draft is ready, but WhatsApp could not open automatically. Use the link below to review and send it. Nothing has been sent by this website.';
    }
  });
})();
