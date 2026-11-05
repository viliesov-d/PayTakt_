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
public class GenerateAndroidIcon {
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
    BufferedImage image = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
    Graphics2D g = image.createGraphics();
    g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
    g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
    g.scale(size / 100.0, size / 100.0);
    if (!foreground) {
      g.setColor(NAVY);
      g.fillRoundRect(0, 0, 100, 100, 24, 24);
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
    Path root = Path.of(args.length == 0 ? "android/app/src/main/res" : args[0]);
    Map<String, Integer> densities = Map.of(
      "mdpi", 48, "hdpi", 72, "xhdpi", 96, "xxhdpi", 144, "xxxhdpi", 192
    );
    for (Map.Entry<String, Integer> entry : densities.entrySet()) {
      Path mipmap = root.resolve("mipmap-" + entry.getKey());
      int size = entry.getValue();
      // Android templates may ship WebP icons; remove those to avoid duplicate resources.
      Files.deleteIfExists(mipmap.resolve("ic_launcher.webp"));
      Files.deleteIfExists(mipmap.resolve("ic_launcher_round.webp"));
      Files.deleteIfExists(mipmap.resolve("ic_launcher_foreground.webp"));
      png(mipmap.resolve("ic_launcher.png"), size, false);
      png(mipmap.resolve("ic_launcher_round.png"), size, false);
      png(mipmap.resolve("ic_launcher_foreground.png"), size * 108 / 48, true);
    }

    String adaptive = """
      <adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
        <background android:drawable="@color/ic_launcher_background"/>
        <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
      </adaptive-icon>
      """;
    xml(root.resolve("mipmap-anydpi-v26/ic_launcher.xml"), adaptive);
    xml(root.resolve("mipmap-anydpi-v26/ic_launcher_round.xml"), adaptive);
    xml(root.resolve("values/ic_launcher_background.xml"), """
      <resources><color name="ic_launcher_background">#101C33</color></resources>
      """);
    System.out.println("PayTakt launcher icons generated in " + root);
  }
}
