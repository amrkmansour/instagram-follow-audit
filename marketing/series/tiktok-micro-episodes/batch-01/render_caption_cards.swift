import AppKit

guard CommandLine.arguments.count == 5 else {
    fatalError("Usage: render_caption_cards.swift OUTPUT_DIR HOOK REVEAL PUNCHLINE")
}

let outputDirectory = CommandLine.arguments[1]
let captions = Array(CommandLine.arguments[2...4])
let width = 1080
let height = 1920
try FileManager.default.createDirectory(atPath: outputDirectory, withIntermediateDirectories: true)

func centeredAttributes(size: CGFloat, color: NSColor) -> [NSAttributedString.Key: Any] {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    return [
        .font: NSFont.systemFont(ofSize: size, weight: .black),
        .foregroundColor: color,
        .paragraphStyle: paragraph,
        .kern: 0.4,
    ]
}

func save(_ image: NSImage, name: String) throws {
    guard let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let png = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("Could not encode \(name)")
    }
    try png.write(to: URL(fileURLWithPath: outputDirectory).appendingPathComponent(name))
}

for (index, caption) in captions.enumerated() {
    let image = NSImage(size: NSSize(width: width, height: height))
    image.lockFocus()
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()

    let box = NSBezierPath(roundedRect: NSRect(x: 55, y: 1625, width: 970, height: 170), xRadius: 28, yRadius: 28)
    NSColor(calibratedWhite: 0.02, alpha: 0.78).setFill()
    box.fill()
    let fontSize: CGFloat = caption.count > 30 ? 44 : 52
    NSAttributedString(string: caption, attributes: centeredAttributes(size: fontSize, color: .white))
        .draw(with: NSRect(x: 82, y: 1665, width: 916, height: 90), options: [.usesLineFragmentOrigin])
    image.unlockFocus()
    try save(image, name: "caption-\(index + 1).png")
}

let endCard = NSImage(size: NSSize(width: width, height: height))
endCard.lockFocus()
NSColor(calibratedRed: 0.07, green: 0.09, blue: 0.09, alpha: 0.93).setFill()
NSRect(x: 0, y: 0, width: width, height: height).fill()
NSAttributedString(string: "CHECK YOUR CURRENT FOLLOW LIST", attributes: centeredAttributes(size: 48, color: NSColor(calibratedRed: 0.89, green: 0.71, blue: 0.30, alpha: 1)))
    .draw(in: NSRect(x: 60, y: 1160, width: 960, height: 70))
NSAttributedString(string: "FOLLOW-CHECK.COM", attributes: centeredAttributes(size: 76, color: .white))
    .draw(in: NSRect(x: 50, y: 1000, width: 980, height: 100))
NSAttributedString(string: "$2.99 · PRIVATE IN YOUR BROWSER", attributes: centeredAttributes(size: 34, color: NSColor(calibratedRed: 0.96, green: 0.92, blue: 0.84, alpha: 1)))
    .draw(in: NSRect(x: 80, y: 890, width: 920, height: 55))
endCard.unlockFocus()
try save(endCard, name: "end-card.png")
