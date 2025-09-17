# 🤖 AI Character Chat (Client-Side)

![Chat Screenshot Placeholder](https://via.placeholder.com/800x400?text=AI+Character+Chat+Screenshot)
*(Consider adding an actual screenshot of your chat interface here!)*

A fully client-side (HTML, CSS, JavaScript) web application that allows users to create and chat with AI characters using the KoboldCpp API. This project provides a user-friendly interface to define a custom AI persona, set names for both the user and the AI, and engage in dynamic conversations, all running directly in your browser.

## ✨ Features

*   **Dynamic Character Creation**: Define your AI's personality, speaking style, and background using a custom persona prompt.
*   **Custom Naming**: Personalize the chat experience by setting your own name and your AI character's name.
*   **Persistent Settings**: Your last used names and persona are saved locally in your browser for convenience.
*   **Interactive Chat Interface**: A clean, modern UI built with Tailwind CSS, featuring smooth message animations and a typing indicator.
*   **Direct API Integration**: Communicates directly with the KoboldCpp API from the browser (no backend server required for logic).
*   **Responsive Design**: Optimized for both desktop and mobile devices.

## 🚀 How It Works

This application is built entirely with client-side technologies (HTML, CSS, JavaScript).
1.  **Configuration Screen**: Upon loading, the user is presented with a settings screen to input:
    *   **Your Name**: The name displayed for your messages.
    *   **Character Name**: The name for the AI.
    *   **Character Persona**: A detailed prompt describing the AI's personality, role, and interaction style. A default "Assistant" persona is provided.
2.  **Chat Session**: Once settings are confirmed, the chat screen appears.
3.  **Prompt Construction**: When you send a message, the JavaScript code constructs a comprehensive prompt that includes:
    *   The defined **Character Persona**.
    *   The entire **conversation history** (your messages and the AI's previous responses), dynamically labeling each turn with your chosen names (e.g., "Alex: My message", "Luna: Her response").
    *   A final line of `[Character Name]:` to guide the AI to generate its next response in character.
4.  **API Call**: This complete prompt is then sent as a `POST` request to the KoboldCpp API endpoint (`https://koboldai-koboldcpp-tiefighter.hf.space/api/v1/generate`).
5.  **Response Processing**: The AI's generated text is received, trimmed, and parsed to ensure clean, in-character output. It's then added to the conversation history and displayed in the chatbox.

## 🛠️ Technologies Used

*   **HTML5**: Structure of the web application.
*   **Tailwind CSS**: For utility-first styling and responsive design.
*   **JavaScript (ES6+)**: All application logic, API calls, and UI manipulation.
*   **AOS (Animate On Scroll)**: For subtle scroll animations (though not heavily utilized in the current chat view).
*   **Feather Icons**: For scalable vector icons.
*   **KoboldCpp API**: The Large Language Model (LLM) backend providing text generation capabilities.

## 🚦 Setup and Installation

This project is incredibly easy to set up as it requires **no backend server** for its logic.

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/altkriz/AIChat.git
    cd AIChat
    ```
2.  **Open in Browser:**
    Simply open the `index.html` file in your web browser. That's it!

    Alternatively, you can host it on any simple web server (e.g., Apache, Nginx, or a GitHub Pages deployment) if you prefer.

## 💡 Usage

1.  **Access the Application**: Open `index.html` in your web browser.
2.  **Configure Your Chat**:
    *   **Your Name**: Enter the name you want to use for your messages.
    *   **Character Name**: Enter the name for your AI companion.
    *   **Character Personality**: Input a detailed description of how you want your AI to behave. A default "helpful assistant" persona is pre-filled, which you can modify.
3.  **Start Chatting**: Click the "Start Chatting" button.
4.  **Engage in Conversation**: Type your messages in the input field and press Enter or click the send button. The AI will respond based on its persona and the conversation history.
5.  **Back to Settings**: Click the settings icon in the chat header to return to the configuration screen and create a new character or modify existing settings.

## ⚠️ Important Considerations

*   **API Exposure**: This client-side implementation makes direct calls to the KoboldCpp API. The specific endpoint used (`https://koboldai-koboldcpp-tiefighter.hf.space/api/v1/generate`) does not currently require an API key, so there's no sensitive information being exposed. However, be mindful that for other APIs requiring authentication, a server-side proxy would be essential for security.
*   **Rate Limits**: The KoboldCpp API on Hugging Face Spaces might have rate limits or usage restrictions. Heavy usage could lead to temporary service interruptions.
*   **Performance**: AI response times depend on the KoboldCpp API's current load and the complexity of your prompt.
*   **Persona Fidelity**: The AI's adherence to the persona can vary based on the underlying model and the quality/detail of your persona description.

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements, bug fixes, or new features, please feel free to:

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
