export const statusElem = document.getElementById('status-text');

export function updateStatus(message) {
    if (statusElem) {
        statusElem.innerText = message;
    }
}
