package app.kalorientracker;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Brücke von der Web-App zum Widget (Gegenstück: src/native-widget.js).
@CapacitorPlugin(name = "KalorienWidget")
public class KalorienWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        KalorienWidgetProvider.save(getContext(), call.getInt("kcal", 0), call.getString("dateKey", ""));
        KalorienWidgetProvider.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void takeCameraRequest(PluginCall call) {
        JSObject result = new JSObject();
        result.put("camera", MainActivity.takeCameraRequest());
        call.resolve(result);
    }
}
