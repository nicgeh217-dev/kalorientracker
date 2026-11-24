package app.kalorientracker;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.getcapacitor.PluginCall;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

// Gemeinsame Daten der Widgets. Android kann die App-Datenbank nicht lesen, darum schickt die Web-App die Tageswerte hierher.
final class WidgetData {
    private static final String PREFS = "kalorien_widget";
    private static final String[] KEYS = {"kcal", "goal", "protein", "carbs", "fat", "proteinGoal", "steps", "sleepMin", "restingHr"};

    private WidgetData() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static void save(Context context, PluginCall call) {
        SharedPreferences.Editor e = prefs(context).edit();
        e.putString("dateKey", call.getString("dateKey", ""));
        for (String k : KEYS) e.putInt(k, call.getInt(k, 0));
        e.apply();
    }

    // Stammen die Werte von gestern, gilt für heute 0.
    static int today(Context context, String key) {
        SharedPreferences p = prefs(context);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        return today.equals(p.getString("dateKey", "")) ? p.getInt(key, 0) : 0;
    }

    static PendingIntent action(Context context, String act) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(MainActivity.ACTION_WIDGET)
            .putExtra(MainActivity.EXTRA_ACT, act)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, act.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent open(Context context) {
        Intent intent = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        for (Class<? extends AppWidgetProvider> cls : new Class[] {KalorienWidgetProvider.class, NutritionWidgetProvider.class, BodyWidgetProvider.class}) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, cls));
            if (ids.length == 0) continue;
            try {
                cls.getDeclaredConstructor().newInstance().onUpdate(context, manager, ids);
            } catch (ReflectiveOperationException ignored) {
                // Das Widget zeigt dann den letzten Stand.
            }
        }
    }
}
