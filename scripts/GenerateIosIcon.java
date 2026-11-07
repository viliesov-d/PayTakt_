import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Path2D;
import java.awt.image.BufferedImage;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import javax.imageio.ImageIO;

/**
 * Generates native launcher icons using the PayTakt calendar/checkmark colors.
 * No downloaded art, extra packages, or Android Studio GUI are required.
 */
public class GenerateIosIcon {
  private static final Color NAVY = new Color(0x101C33);
  private static final Color LIME = new Color(0xC2F075);

  private static void drawCalendar(Graphics2D g) {
    // Launcher masks crop edges unpredictably. Keep the calendar inside
    // the adaptive-icon safe zone (the old graphic was too large).
    g.translate(50.0, 50.0);
    g.scale(0.72, 0.72);
    g.translate(-50.0, -50.0);
    g.setColor(LIME);
    g.fillRoundRect(23, 27, 54, 53, 10, 10);
    g.setColor(NAVY);
    g.setStroke(new BasicStroke(3.5f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
    g.drawLine(23, 43, 77, 43);
    g.setColor(LIME);
    g.setStroke(new BasicStroke(6f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
    g.drawLine(36, 22, 36, 32);
    g.drawLine(64, 22, 64, 32);
    g.setColor(NAVY);
    g.setStroke(new BasicStroke(6f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
    Path2D check = new Path2D.Double();
    check.moveTo(34, 59);
    check.lineTo(45, 69);
    check.lineTo(66, 50);
    g.draw(check);
  }

  private static void png(Path path, int size, boolean foreground) throws Exception {
    BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_RGB);
    Graphics2D g = image.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    g.scale(size / 100.0, size / 100.0);
    if (!foreground) {
      g.setColor(NAVY);
      g.fillRect(0, 0, 100, 100);
    }
    drawCalendar(g);
    g.dispose();
    Files.createDirectories(path.getParent());
    if (!ImageIO.write(image, "png", path.toFile())) throw new IllegalStateException("PNG writer unavailable");
  }

  private static void xml(Path path, String content) throws Exception {
    Files.createDirectories(path.getParent());
    Files.writeString(path, content, StandardCharsets.UTF_8);
  }

  public static void main(String[] args) throws Exception {
    png(Path.of("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"), 1024, false);
  }
}
