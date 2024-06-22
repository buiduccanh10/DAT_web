// window.addEventListener('DOMContentLoaded', event => {
//     // Simple-DataTables
//     // https://github.com/fiduswriter/Simple-DataTables/wiki

//     const datatablesSimple = document.getElementById('datatablesSimple');
//     if (datatablesSimple) {
//         new simpleDatatables.DataTable(datatablesSimple);
//     }
// });
window.addEventListener('DOMContentLoaded', event => {
    const datatablesSimple = document.getElementById('datatablesSimple');
    if (datatablesSimple) {
        const dataTable = new simpleDatatables.DataTable(datatablesSimple, {
            searchable: true
        });

        // Wait until the table is fully initialized
        dataTable.on('datatable.init', () => {
            // Manually hide columns by setting CSS display to none
            const columnIndicesToHide = [18, 19, 20, 21];
            columnIndicesToHide.forEach(index => {
                const header = datatablesSimple.querySelector(`thead th:nth-child(${index + 1})`);
                const cells = datatablesSimple.querySelectorAll(`tbody td:nth-child(${index + 1})`);
                if (header) {
                    header.style.display = 'none';
                }
                cells.forEach(cell => {
                    cell.style.display = 'none';
                });
            });
        });

        const searchInput = document.querySelector('.datatable-input');
            if (searchInput) {
                searchInput.addEventListener('keyup', () => {
                    dataTable.search(searchInput.value.trim(), [1]); 
                    dataTable.search(searchInput.value.trim(), [3]); // Adjust the index [3] for 'Họ tên' column
                    dataTable.search(searchInput.value.trim(), [6]);
                });
            }
    }
});