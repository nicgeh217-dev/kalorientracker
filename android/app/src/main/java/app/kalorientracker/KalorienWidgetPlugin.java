package app.kalorientracker;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Brücke von der Web-App zu den Widgets (Gegenstück: src/native-widget.js).
@CapacitorPlugin(name = "KalorienWidget")
public class KalorienWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        WidgetData.save(getContext(), call);
        WidgetData.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void takeAction(PluginCall call) {
        JSObject result = new JSObject();
        result.put("action", MainActivity.takeAction());
        call.resolve(result);
    }
}
