import AppKit

let width = 1080
let height = 1920
let outputDirectory = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "marketing/video/overlays"

try FileManager.default.createDirectory(
    atPath: outputDirectory,
    withIntermediateDirectories: true
)

struct Card {
    let filename: String
    let lines: [String]
    let top: CGFloat
    let opaque: Bool
}

let cards = [
    Card(filename: "01-hook.png", lines: ["POV: YOU FOLLOW", "HUNDREDS OF PEOPLE…"], top: 170, opaque: false),
    Card(filename: "02-question.png", lines: ["BUT WHO ACTUALLY", "FOLLOWS YOU BACK?"], top: 170, opaque: false),
    Card(filename: "03-case-opened.png", lines: ["CASE OPENED"], top: 190, opaque: false),
    Card(filename: "04-privacy.png", lines: ["NO PASSWORD", "YOUR FILE STAYS ON YOUR DEVICE"], top: 150, opaque: false),
    Card(filename: "05-end-card.png", lines: ["FOLLOW CHECK", "FIND THE ONE-WAY FOLLOWS", "FOLLOW-CHECK.COM", "$2.99 · ONE AUDIT", "INDEPENDENT TOOL · NOT AFFILIATED WITH INSTAGRAM OR META"], top: 430, opaque: true)
]

let cream = NSColor(calibratedRed: 0.969, green: 0.949, blue: 0.890, alpha: 1)
let green = NSColor(calibratedRed: 0.125, green: 0.239, blue: 0.180, alpha: 1)
let red = NSColor(calibratedRed: 0.616, green: 0.196, blue: 0.122, alpha: 1)

func roundedBox(_ rect: NSRect) {
    let path = NSBezierPath(roundedRect: rect, xRadius: 28, yRadius: 28)
    NSColor(calibratedWhite: 0.04, alpha: 0.78).setFill()
    path.fill()
}

for card in cards {
    let image = NSImage(size: NSSize(width: width, height: height))
    image.lockFocus()

    if card.opaque {
        cream.setFill()
        NSRect(x: 0, y: 0, width: width, height: height).fill()
    }

    var y = CGFloat(height) - card.top

    for (index, line) in card.lines.enumerated() {
        let isBrand = card.opaque && index == 0
        let isDomain = card.opaque && index == 2
        let isDisclaimer = card.opaque && index == 4
        let fontSize: CGFloat = isBrand ? 108 : (isDomain ? 62 : (isDisclaimer ? 25 : (card.opaque ? 48 : 64)))
        let color = card.opaque ? (isBrand ? red : green) : NSColor.white
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: fontSize, weight: isBrand ? .black : .bold),
            .foregroundColor: color,
            .paragraphStyle: paragraph,
            .kern: isBrand ? 1.5 : 0.4
        ]
        let text = NSAttributedString(string: line, attributes: attributes)
        let measured = text.boundingRect(
            with: NSSize(width: 940, height: 240),
            options: [.usesLineFragmentOrigin, .usesFontLeading]
        )
        let lineHeight = ceil(measured.height)
        let rect = NSRect(x: 70, y: y - lineHeight, width: 940, height: lineHeight + 8)

        if !card.opaque {
            roundedBox(NSRect(x: max(45, rect.minX - 18), y: rect.minY - 10, width: min(990, rect.width + 36), height: rect.height + 20))
        }

        text.draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading])
        y -= lineHeight + (isBrand ? 74 : (isDisclaimer ? 12 : 42))
    }

    image.unlockFocus()

    guard let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let png = bitmap.representation(using: .png, properties: [:]) else {
        fatalError("Could not encode \(card.filename)")
    }

    let url = URL(fileURLWithPath: outputDirectory).appendingPathComponent(card.filename)
    try png.write(to: url)
}
