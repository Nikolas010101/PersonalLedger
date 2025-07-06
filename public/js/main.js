document
    .getElementById("uploadForm")
    .addEventListener("submit", async function (event) {
        event.preventDefault();

        const fileInput = document.getElementById("fileInput");
        const file = fileInput.files[0];

        if (!file) {
            alert("Please select a file.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        fetch("/upload", {
            method: "POST",
            body: formData,
        });
    });
