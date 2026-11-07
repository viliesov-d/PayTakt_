/** Configure Capacitor's generated MainActivity after cap add/sync.
 *
 * Native Android bars are an Android-window concern, not a CSS-only concern.
 * Keep the generated /android directory out of Git; reapply this idempotent
 * patch on EVERY android:setup. Refuse unknown MainActivity customizations.
 */
import {existsSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const root=fileURLToPath(new URL('../',import.meta.url))
const {appId}=JSON.parse(readFileSync(resolve(root,'capacitor.config.json'),'utf8'))
if(typeof appId!=='string'||!/^([a-zA-Z_][\w]*\.)+[a-zA-Z_][\w]*$/.test(appId))
  throw Error('Некоректний Capacitor appId — MainActivity не змінено.')

const activity=resolve(root,'android/app/src/main/java',...appId.split('.'),'MainActivity.java')
if(!existsSync(activity))throw Error('MainActivity.java відсутній: спочатку створи Android-проєкт через Capacitor.')

const source=readFileSync(activity,'utf8')
const marker='// PAYTAKT_EDGE_TO_EDGE_AND_NO_STRETCH'
if(source.includes(marker)){
  console.log('PayTakt Android edge-to-edge already configured.')
  process.exit(0)
}
const expected=new RegExp('^\\s*package\\s+'+appId.replaceAll('.','\\.')+
  ';\\s*import\\s+com\\.getcapacitor\\.BridgeActivity;\\s*public\\s+class\\s+MainActivity\\s+extends\\s+BridgeActivity\\s*\\{\\s*\\}\\s*$')
if(!expected.test(source))
  throw Error('Невідома версія MainActivity.java: автоматична заміна припинена, щоб не зламати нативний код.')

const output=`package ${appId};

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  // PAYTAKT_EDGE_TO_EDGE_AND_NO_STRETCH
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // Fully transparent Android system bars with content behind them.
      // Keep the clock, battery and gesture handle visible.
      EdgeToEdge.enable(this);
      getWindow().setNavigationBarContrastEnforced(false);
    } else {
      // Android 9/10: Capacitor 8 can report zero navigation insets with
      // forced edge-to-edge. Match the app's surface instead of overlapping
      // the gesture/button area on those older phones.
      boolean dark = (getResources().getConfiguration().uiMode
          & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
      int surface = dark ? Color.rgb(16, 24, 39) : Color.rgb(244, 247, 250);
      Window window = getWindow();
      window.setStatusBarColor(surface);
      window.setNavigationBarColor(surface);
      int flags = window.getDecorView().getSystemUiVisibility();
      flags &= ~(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
      if (!dark) flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
      window.getDecorView().setSystemUiVisibility(flags);
    }

    // Android 12+ WebView's elastic EdgeEffect stretches the entire page
    // when pulling beyond the top/bottom. This does NOT disable scrolling.
    if (getBridge() != null && getBridge().getWebView() != null) {
      getBridge().getWebView().setOverScrollMode(View.OVER_SCROLL_NEVER);
    }
  }
}
`;
writeFileSync(activity,output,'utf8')
console.log('PayTakt Android window configured:',activity)
