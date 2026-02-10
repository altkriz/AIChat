# 🤖 KrizVibe Chat (Modern AI RP Client)

A fully client-side (HTML, CSS, JavaScript) web application that allows users to create and chat with AI characters using the KoboldCpp API. This project provides a user-friendly, modern light-themed interface to define custom AI personas, set names, and engage in dynamic conversations directly in your browser.

## ✨ Features

*   **Modern Light UI**: A clean, minimalist dashboard design with a responsive sidebar and smooth chat bubbles.
*   **Dynamic Character Creation**: Define your AI's personality, speaking style, and background.
*   **Rich Text Support**: Messages support Markdown rendering (bold, italics, lists, code blocks) with syntax highlighting.
*   **Custom Avatars**: Set custom avatar URLs for both yourself and the character.
*   **API Configuration**: Easily switch the KoboldCpp API endpoint (default provided).
*   **Long-Term Memory**: Simulates memory persistence for facts, relationships, and world lore.
*   **Persistent Settings**: Your last used names, persona, and chat history are saved locally.
*   **Secure**: Uses DOMPurify to sanitize AI outputs, preventing XSS attacks.
*   **Responsive**: Optimized for both desktop and mobile devices with a collapsible sidebar.

## 🚀 How It Works

This application is built entirely with client-side technologies (HTML, CSS, JavaScript).

1.  **Sidebar Configuration**: Upon loading, the sidebar allows you to input:
    *   **Identity**: Your Name and Avatar URL.
    *   **Character**: Name, Avatar URL, and a detailed Persona/Character Sheet.
    *   **Configuration**: The API URL (defaults to a public KoboldCpp instance).
2.  **Chat Session**: Click "Start Session" to begin.
3.  **Prompt Construction**: When you send a message, the app constructs a prompt including the persona, memory summary, and conversation history.
4.  **API Call**: This prompt is sent to the KoboldCpp API.
5.  **Response**: The AI's text is received, sanitized, formatted with Markdown, and displayed.

## 🛠️ Technologies Used

*   **HTML5 & CSS3**: Semantic structure and custom modern styling (CSS variables, Flexbox).
*   **Tailwind CSS**: Utility classes for layout and responsiveness.
*   **JavaScript (ES6+)**: Application logic, API calls, and DOM manipulation.
*   **Marked.js**: Markdown parsing.
*   **DOMPurify**: HTML sanitization for security.
*   **Highlight.js**: Syntax highlighting for code blocks.
*   **Feather Icons**: scalable vector icons.

## 🚦 Setup and Installation

This project requires **no backend server** for its logic.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/altkriz/AIChat.git
    cd AIChat
    ```
2.  **Open in Browser:**
    Simply open the `index.html` file in your web browser. That's it!

    Alternatively, host it on GitHub Pages or any static file server.

## 💡 Usage

1.  **Access the Application**: Open `index.html`.
2.  **Configure**: Fill in the fields in the sidebar (or use defaults).
3.  **Start Chatting**: Click "Start Session".
4.  **Chat**: Type messages in the auto-expanding textarea.
5.  **Memory**: Toggle the "Long-Term Memory" panel in the sidebar to see what the AI "remembers" about your conversation.

## ⚠️ Important Considerations

*   **API Exposure**: This is a client-side app. Do not use API endpoints that require secret keys unless you are running them locally or through a secure proxy.
*   **Rate Limits**: The default public API endpoint might have rate limits. You can run your own local LLM using [KoboldCpp](https://github.com/LostRuins/koboldcpp) and point the app to `http://localhost:5001/api/v1/generate`.

## 🤝 Contributing

Contributions are welcome!

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'feat: Add new feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).

## 📞 Contact

If you have any questions or need support, please open an issue in the GitHub repository.

---
Enjoy building your custom AI chat experiences!
