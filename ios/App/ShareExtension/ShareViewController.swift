import UIKit
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    private let limit = 10 * 1024 * 1024
    private var used = 0
    private var text = ""
    private var files: [[String: String]] = []
    private let message = UILabel()
    private let done = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0, green: 24 / 255, blue: 64 / 255, alpha: 1)
        message.textColor = .white
        message.numberOfLines = 0
        message.text = "Preparing your shared item…"
        done.setTitle("Done", for: .normal)
        done.addTarget(self, action: #selector(finish), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [message, done])
        stack.axis = .vertical
        stack.spacing = 24
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 32),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -32),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        let providers = (extensionContext?.inputItems as? [NSExtensionItem] ?? [])
            .flatMap { $0.attachments ?? [] }
        guard !providers.isEmpty, providers.count <= 5 else { fail(); return }
        read(providers, index: 0)
    }

    private func read(_ providers: [NSItemProvider], index: Int) {
        guard index < providers.count else { save(); return }
        let provider = providers[index]
        let types = [UTType.fileURL.identifier, UTType.url.identifier,
                     UTType.plainText.identifier, UTType.data.identifier]
        guard let type = types.first(where: { provider.hasItemConformingToTypeIdentifier($0) }) else { fail(); return }
        provider.loadItem(forTypeIdentifier: type, options: nil) { item, error in
            DispatchQueue.main.async {
                guard error == nil else { self.fail(); return }
                do {
                    if let url = item as? URL {
                        if url.isFileURL {
                            let accessing = url.startAccessingSecurityScopedResource()
                            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
                            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
                            guard let size = attributes[.size] as? NSNumber,
                                  size.intValue <= self.limit - self.used else { self.fail(); return }
                            try self.append(Data(contentsOf: url, options: .mappedIfSafe), name: url.lastPathComponent)
                        } else {
                            self.text += (self.text.isEmpty ? "" : "\n") + url.absoluteString
                        }
                    } else if let value = item as? String {
                        self.text += (self.text.isEmpty ? "" : "\n") + value
                    } else if let data = item as? Data {
                        try self.append(data, name: provider.suggestedName ?? "shared-file")
                    } else if let image = item as? UIImage, let data = image.pngData() {
                        try self.append(data, name: "shared-image.png")
                    } else {
                        self.fail(); return
                    }
                    guard self.used + self.text.utf8.count <= self.limit else { self.fail(); return }
                    self.read(providers, index: index + 1)
                } catch { self.fail() }
            }
        }
    }

    private func append(_ data: Data, name: String) throws {
        used += data.count
        guard used + text.utf8.count <= limit else { throw CocoaError(.fileReadTooLarge) }
        files.append(["name": name, "data": data.base64EncodedString()])
    }

    private func save() {
        guard !text.isEmpty || !files.isEmpty,
              let directory = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.tervory.app") else {
            fail(); return
        }
        do {
            let payload: [String: Any] = ["id": UUID().uuidString, "text": text,
                "files": files, "created": Date().timeIntervalSince1970]
            var url = directory.appendingPathComponent("share-inbox.json")
            try JSONSerialization.data(withJSONObject: payload).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try url.setResourceValues(values)
            message.text = "Saved. Open Tervory to continue in chats."
        } catch { fail() }
    }

    private func fail() {
        message.text = "This item could not be saved. Share up to five files totaling 10 MB, then try again."
    }

    @objc private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
