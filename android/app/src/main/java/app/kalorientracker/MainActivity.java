package app.kalorientracker;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Tipp auf ein Widget: Intent mit dieser Aktion und dem Extra "act" (camera, barcode, workout, weight).
    static final String ACTION_WIDGET = "app.kalorientracker.WIDGET_ACTION";
    static final String ACTION_WIDGET_CAMERA = "app.kalorientracker.WIDGET_CAMERA"; // altes Kalorien-Widget
    static final String EXTRA_ACT = "act";
    private static String pendingAction = "";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KalorienWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    // Läuft beim Antippen des Widgets, auch beim Kaltstart (BridgeActivity ruft es aus onCreate auf).
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null) return;
        String action = "";
        if (ACTION_WIDGET_CAMERA.equals(intent.getAction())) action = "camera";
        else if (ACTION_WIDGET.equals(intent.getAction())) {
            String act = intent.getStringExtra(EXTRA_ACT);
            action = act == null ? "" : act;
        }
        if (action.isEmpty()) return;
        intent.setAction(Intent.ACTION_MAIN); // damit ein Neuaufbau der Activity die Aktion nicht erneut auslöst
        requestAction(action);
        if (getBridge() != null) getBridge().triggerWindowJSEvent("widgetaction");
    }

    private static synchronized void requestAction(String action) {
        pendingAction = action;
    }

    // Die Web-App holt die Anforderung ab. Beim Kaltstart ist sie erst nach dem Laden bereit.
    static synchronized String takeAction() {
        String action = pendingAction;
        pendingAction = "";
        return action;
    }
}
