document.querySelectorAll('input[role="switch"]').forEach(input => {
    const sync = () => input.setAttribute('aria-checked', String(input.checked));
    input.addEventListener('change', sync);
    window.addEventListener('pageshow', sync);
    sync();
});
