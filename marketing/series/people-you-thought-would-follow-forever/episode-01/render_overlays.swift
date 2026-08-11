import AppKit

let width = 1080
let height = 1920
let outputDirectory = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "work"
try FileManager.default.createDirectory(atPath: outputDirectory, withIntermediateDirectories: true)

struct Card {
    let filename: String
    let text: String
    let speakerColor: NSColor
    let endCard: Bool
}

let cream = NSColor(calibratedRed: 0.97, green: 0.94, blue: 0.86, alpha: 1)
let ink = NSColor(calibratedRed: 0.08, green: 0.08, blue: 0.09, alpha: 1)
let mustard = NSColor(calibratedRed: 0.87, green: 0.55, blue: 0.10, alpha: 1)
let teal = NSColor(calibratedRed: 0.06, green: 0.34, blue: 0.36, alpha: 1)
let rust = NSColor(calibratedRed: 0.61, green: 0.20, blue: 0.11, alpha: 1)

let cards = [
    Card(filename: "01-cass.png", text: "FRIENDS FOREVER?", speakerColor: teal, endCard: false),
    Card(filename: "02-teen-jordan.png", text: "OBVIOUSLY.", speakerColor: mustard, endCard: false),
    Card(filename: "03-cass-name.png", text: "CASS?", speakerColor: rust, endCard: false),
    Card(filename: "04-seriously.png", text: "SERIOUSLY?", speakerColor: rust, endCard: false),
    Card(filename: "05-vacation.png", text: "AFTER EVERY VACATION PHOTO?", speakerColor: cream, endCard: false),
    Card(filename: "06-follower.png", text: "SHE WAS A FOLLOWER. THEN SHE WASN’T.", speakerColor: cream, endCard: false),
    Card(filename: "07-memory.png", text: "I CAN KEEP THE MEMORY.", speakerColor: mustard, endCard: false),
    Card(filename: "08-end.png", text: "", speakerColor: cream, endCard: true)
]

func centeredAttributes(size: CGFloat, color: NSColor, weight: NSFont.Weight) -> [NSAttributedString.Key: Any] {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    return [
        .font: NSFont.systemFont(ofSize: size, weight: weight),
        .foregroundColor: color,
        .paragraphStyle: paragraph,
        .kern: 0.8
    ]
}

for card in cards {
    let image = NSImage(size: NSSize(width: width, height: height))
    image.lockFocus()

    if card.endCard {
        ink.setFill()
        NSRect(x: 0, y: 0, width: width, height: height).fill()

        let eyebrow = NSAttributedString(
            string: "PEOPLE YOU THOUGHT WOULD FOLLOW FOREVER",
            attributes: centeredAttributes(size: 29, color: mustard, weight: .semibold)
        )
        eyebrow.draw(in: NSRect(x: 80, y: 1280, width: 920, height: 70))

        let headline = NSAttributedString(
            string: "SOME MYSTERIES\nARE PERSONAL.",
            attributes: centeredAttributes(size: 82, color: cream, weight: .black)
        )
        headline.draw(with: NSRect(x: 70, y: 890, width: 940, height: 260), options: [.usesLineFragmentOrigin])

        let brand = NSAttributedString(
            string: "FOLLOW CHECK",
            attributes: centeredAttributes(size: 58, color: rust, weight: .black)
        )
        brand.draw(in: NSRect(x: 80, y: 665, width: 920, height: 80))

        let url = NSAttributedString(
            string: "FOLLOW-CHECK.COM",
            attributes: centeredAttributes(size: 34, color: cream, weight: .bold)
        )
        url.draw(in: NSRect(x: 80, y: 575, width: 920, height: 55))
    } else {
        let caption = NSAttributedString(
            string: card.text,
            attributes: centeredAttributes(size: card.text.count > 28 ? 46 : 62, color: NSColor.white, weight: .black)
        )
        let measured = caption.boundingRect(with: NSSize(width: 900, height: 190), options: [.usesLineFragmentOrigin])
        let captionHeight = max(92, ceil(measured.height) + 34)
        let rect = NSRect(x: 70, y: 1600 - captionHeight, width: 940, height: captionHeight)
        let box = NSBezierPath(roundedRect: rect, xRadius: 30, yRadius: 30)
        NSColor(calibratedWhite: 0.02, alpha: 0.80).setFill()
        box.fill()
        card.speakerColor.setFill()
        NSBezierPath(roundedRect: NSRect(x: 70, y: rect.minY, width: 16, height: rect.height), xRadius: 8, yRadius: 8).fill()
        caption.draw(with: NSRect(x: 100, y: rect.minY + 17, width: 880, height: rect.height - 24), options: [.usesLineFragmentOrigin])
    }

    image.unlockFocus()
    guard let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let png = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("Could not encode \(card.filename)")
    }
    try png.write(to: URL(fileURLWithPath: outputDirectory).appendingPathComponent(card.filename))
}
