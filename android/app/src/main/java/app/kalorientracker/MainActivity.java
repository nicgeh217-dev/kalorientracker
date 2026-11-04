package app.kalorientracker;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    static final String ACTION_WIDGET_CAMERA = "app.kalorientracker.WIDGET_CAMERA";
    private static boolean cameraRequested = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KalorienWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }

    // Läuft beim Antippen des Widgets, auch beim Kaltstart (BridgeActivity ruft es aus onCreate auf).
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null || !ACTION_WIDGET_CAMERA.equals(intent.getAction())) return;
        intent.setAction(Intent.ACTION_MAIN); // damit ein Neuaufbau der Activity die Kamera nicht erneut öffnet
        requestCamera();
        if (getBridge() != null) getBridge().triggerWindowJSEvent("widgetcamera");
    }

    private static synchronized void requestCamera() {
        cameraRequested = true;
    }

    // Die Web-App holt die Anforderung ab. Beim Kaltstart ist sie erst nach dem Laden bereit.
    static synchronized boolean takeCameraRequest() {
        boolean requested = cameraRequested;
        cameraRequested = false;
        return requested;
    }
}
