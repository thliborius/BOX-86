"""Rebuild our original 5×7 pixel font (optional tooling: Python fonttools)."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

# Each hexadecimal row is five pixels wide. No third-party font source.
patterns = {
    "A":"0e11111f111111", "B":"1e11111e11111e", "C":"0e11101010110e",
    "D":"1e11111111111e", "E":"1f10101e10101f", "F":"1f10101e101010",
    "G":"0e11101711110f", "H":"1111111f111111", "I":"0e04040404040e",
    "J":"0702020212120c", "K":"11121418141211", "L":"1010101010101f",
    "M":"111b1515111111", "N":"11191915131311", "O":"0e11111111110e",
    "P":"1e11111e101010", "Q":"0e11111115120d", "R":"1e11111e141211",
    "S":"0f10100e01011e", "T":"1f040404040404", "U":"1111111111110e",
    "V":"11111111110a04", "W":"11111115151b11", "X":"11110a040a1111",
    "Y":"11110a04040404", "Z":"1f01020408101f",
    "a":"00000e010f110f", "b":"10101e1111111e", "c":"00000e1110110e",
    "d":"01010f1111110f", "e":"00000e111f100e", "f":"0609081c080808",
    "g":"00000f110f010e", "h":"10101e11111111", "i":"04000c0404040e",
    "j":"0200060202120c", "k":"101011121c1211", "l":"0c04040404040e",
    "m":"00001a15151515", "n":"00001e11111111", "o":"00000e1111110e",
    "p":"00001e111e1010", "q":"00000f110f0101", "r":"00001619101010",
    "s":"00000f100e011e", "t":"08081c08080906", "u":"0000111111130d",
    "v":"00001111110a04", "w":"0000111515150a", "x":"0000110a040a11",
    "y":"000011110f010e", "z":"00001f0204081f",
    "0":"0e11131519110e", "1":"040c040404040e", "2":"0e11010204081f",
    "3":"1e01010e01011e", "4":"02060a121f0202", "5":"1f101e0101110e",
    "6":"0610101e11110e", "7":"1f010204080808", "8":"0e11110e11110e",
    "9":"0e11110f01010c", " ":"00000000000000", ".":"00000000000c0c",
    ",":"00000000000c08", ":":"000c0c000c0c00", ";":"000c0c000c0c08",
    "/":"01020204080810", "-":"0000001f000000", "·":"00000004000000",
    "!":"04040404040004", "?":"0e110204040004", "&":"0c12140c15120d",
    "(":"02040808080402", ")":"08040202020408", "+":"0004041f040400",
    "=":"00001f001f0000", "_":"0000000000001f", "'":"04040800000000",
    "↑":"040e1504040404", "↓":"04040404150e04", "←":"0008101f100800",
    "→":"0002011f010200", "✓":"00000102140800", "●":"000e1f1f1f0e00",
    "•":"0000040e040000", "ß":"0c12141a11101a",
}
rows = {c: [int(p[i:i+2],16) for i in range(0,len(p),2)] for c,p in patterns.items()}
for accented, base in [("ä","a"),("ö","o"),("ü","u"),("Ä","A"),("Ö","O"),("Ü","U")]:
    rows[accented] = [10,0] + rows[base]
font = FontBuilder(1000, isTTF=True)
order = [".notdef"] + [f"uni{ord(c):04X}" for c in rows]
font.setupGlyphOrder(order)
font.setupCharacterMap({ord(c):f"uni{ord(c):04X}" for c in rows})
glyphs = {}; metrics = {}
for name, pixels in [(".notdef",[31,17,21,17,31])] + [(f"uni{ord(c):04X}",r) for c,r in rows.items()]:
    pen = TTGlyphPen(None)
    for y, row in enumerate(pixels):
        for x in range(5):
            if row & (1 << (4-x)):
                left = x*100; bottom = (len(pixels)-1-y)*100
                pen.moveTo((left,bottom)); pen.lineTo((left+100,bottom))
                pen.lineTo((left+100,bottom+100)); pen.lineTo((left,bottom+100)); pen.closePath()
    glyphs[name] = pen.glyph(); metrics[name] = (600,0)
font.setupGlyf(glyphs); font.setupHorizontalMetrics(metrics)
font.setupHorizontalHeader(ascent=900, descent=-100)
font.setupNameTable({"familyName":"BOX86 Pixel","styleName":"Regular","uniqueFontIdentifier":"BOX86-Pixel-1","fullName":"BOX86 Pixel","psName":"BOX86Pixel","version":"Version 1.0","copyright":"Original pixel lettering for BOX//86. MIT license; see LICENSE."})
font.setupOS2(sTypoAscender=900,sTypoDescender=-100,usWinAscent=900,usWinDescent=100)
font.setupPost(); font.setupMaxp()
font.save(Path(__file__).resolve().parent.parent / "src/assets/box86-pixel.ttf")
