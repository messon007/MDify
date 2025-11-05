# MDify - Modern Markdown Editor with AI Assistant

MDify is a powerful, privacy-friendly, and installable Markdown editor with modern features and built-in AI capabilities that runs in your browser. Designed for writers, developers, and creators who want speed, flexibility, and complete control of their content.

## Key Features

- **AI Assistant** - Generate, modify, and extend content using AI
- **Real-time Markdown preview** - See formatted output as you type
- **Advanced formatting** - Tables, code blocks, syntax highlighting
- **Visual elements** - Charts and diagrams using ToastUI integration
- **Dark theme & RTL support** for better accessibility
- **PWA support** - Install as a desktop/mobile app
- **Persian font support** - Vazirmatn font family included
- **Export capabilities** - Save documents in Markdown and HTML formats

### 🚀 Getting Started

1. Open [the app](https://yasinc2.github.io/MDify/) in your browser.
2. Optionally install it as a PWA for offline use.
3. Start writing Markdown with live preview, auto-save, and export options.

## AI Assistant Features

### Role Management
- Select from predefined roles (Writer, Blogger, Health Expert, Coach)
- Create custom roles with:
  - Custom system prompts
  - Temperature control
  - Top-p sampling configuration
  - Role-specific settings

### Content Generation
- **Write with AI**:
  - Generate outlines based on prompts
  - Produce full content from outlines
  - Append to or replace existing content
- **Modify/Extend**:
  - Revise selected text
  - Expand on existing content
  - Preserve context while editing

### Configuration Options
- **Provider Selection**:
  - Pollinations.ai (default)
  - OpenAI (requires API key)
- **Model Management**:
  - Load available models
  - Select appropriate model for task
- **API Settings**:
  - Custom endpoint configuration
  - Secure API key storage (local browser storage)

### Basic Editor Functions
1. Type Markdown in the left editor pane
2. See formatted preview in the right pane
3. Use toolbar buttons for formatting
4. Access additional features via menu

### Using the AI Assistant
1. Click the AI Assistant button in the toolbar
2. Select a role or create a custom role
3. Choose an operation mode:
   - **Write with AI**: Generate new content
   - **Modify/Extend**: Edit existing content
4. Configure API settings if using OpenAI
5. Enter your prompt and generate content

### Exporting Documents
- **Markdown**: Save as .md file
- **Basic HTML**: Simple HTML export
- **Styled HTML**: Preserves editor styling and syntax highlighting
- **Print-ready HTML**: Both basic and styled HTML export, includes page break support

## Configuration

### AI Settings
1. Open AI Assistant modal
2. Navigate to "AI Settings" section
3. Select provider (PollinationsAI or OpenAI)
4. Config:
   - Enter API endpoint
   - Provide your API key
   - Click "Load Models" to populate model list
5. Save settings

### Custom Roles
1. Enable "Custom Instructions" toggle
2. Define:
   - Role name
   - System prompt
   - Temperature (0-3)
   - Top-p sampling (0-1)
3. Click "Save Role"

## Credits

MDify utilizes several open-source resources:

- [ToastUI Editor](https://ui.toast.com/tui-editor) - Markdown editor component
- [Prism.js](https://prismjs.com/) - Syntax highlighting
- [Vazirmatn Font](https://github.com/rastikerdar/vazirmatn) - Persian/Arabic font
- [Vazir Code Font](https://github.com/rastikerdar/vazir-code-font) - Persian monospaced font

We're grateful to the creators of these projects.

## License
Licensed under [GPL-3.0 license](LICENSE).

## Contributing
Contributions welcome! Please follow these steps:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request
4. Include tests for new features

Report issues in the [GitHub issue tracker](https://github.com/YasinC2/MDify/issues).
