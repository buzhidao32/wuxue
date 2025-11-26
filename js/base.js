function toggleOptionMenu(event) {
    const menu = document.getElementById('optionMenu');
    const buttonRect = event.target.getBoundingClientRect();
    menu.style.left = `${buttonRect.right - menu.offsetWidth}px`;
    menu.style.top = `${buttonRect.bottom}px`;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}
document.addEventListener('DOMContentLoaded', () => {
    const optionBtn = document.getElementById('optionBtn');
    optionBtn.addEventListener('click', (event) => {
        toggleOptionMenu(event);
    });
});