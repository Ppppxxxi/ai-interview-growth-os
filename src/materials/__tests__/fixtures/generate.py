"""Generate synthetic fixtures only; no personal or downloaded documents."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from reportlab.pdfgen import canvas
from reportlab.lib.pdfencrypt import StandardEncryption
from PIL import Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from pypdf import PdfReader, PdfWriter

root = Path(__file__).parent

def pdf(name, pages, encryption=None):
    c = canvas.Canvas(str(root / name), invariant=1, encrypt=encryption)
    for text in pages:
        c.drawString(50, 750, text)
        c.showPage()
    c.save()

pdf('synthetic.pdf', ['Synthetic project alpha', 'Synthetic research beta'])
pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
c = canvas.Canvas(str(root / 'chinese.pdf'), invariant=1)
c.setFont('STSong-Light', 12)
c.drawString(50, 750, '\u865a\u6784\u9879\u76ee\u7528\u6237\u7814\u7a76')
c.save()
writer = PdfWriter()
writer.append(PdfReader(root / 'synthetic.pdf'))
writer.add_js('globalThis.fixtureExecuted=true; app.launchURL("https://example.invalid/fixture");')
writer.add_uri(0, 'https://example.invalid/fixture', [50, 700, 200, 750])
with (root / 'active-content.pdf').open('wb') as output:
    writer.write(output)
pdf('encrypted.pdf', ['Synthetic secret'], StandardEncryption('fictional-password'))
pdf('encrypted-empty-password.pdf', ['Synthetic secret'], StandardEncryption('', ownerPassword='fictional-owner'))
for name, final_length in [('exact-limit.pdf', 1000), ('over-limit.pdf', 1001)]:
    c = canvas.Canvas(str(root / name), invariant=1)
    for i in range(50):
        c.setFont('Helvetica', 0.5)
        c.drawString(50, 750, 'x' * (998 if i < 49 else final_length))
        c.showPage()
    c.save()
image = Image.new('RGB', (20, 20), 'white')
image.putpixel((10, 10), (0, 0, 0))
image.save(root / 'synthetic-scan.png')
c = canvas.Canvas(str(root / 'scanned.pdf'), invariant=1)
c.drawImage(str(root / 'synthetic-scan.png'), 50, 500, width=200, height=200)
c.save()
c = canvas.Canvas(str(root / 'mixed-scan.pdf'), invariant=1)
c.drawString(50, 750, 'Synthetic text page')
c.showPage()
c.drawImage(str(root / 'synthetic-scan.png'), 50, 500, width=200, height=200)
c.save()
c = canvas.Canvas(str(root / 'blank-page.pdf'), invariant=1)
c.showPage()
c.drawString(50, 750, 'Synthetic text page')
c.save()
(root / 'synthetic-scan.png').unlink()

def docx(name, text):
    with ZipFile(root / name, 'w', ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p><w:p><w:hyperlink r:id="external"><w:r><w:t>Synthetic link label</w:t></w:r></w:hyperlink></w:p></w:body></w:document>')
        z.writestr('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:globalThis.fixtureExecuted=true" TargetMode="External"/></Relationships>')

docx('synthetic.docx', 'Synthetic project alpha')
docx('too-long.docx', 'x' * 50001)
docx('exact-limit.docx', 'x' * 49976)
