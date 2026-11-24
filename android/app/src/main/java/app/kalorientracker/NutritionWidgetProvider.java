package app.kalorientracker;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

// Ernährung: Kalorien übrig (das Ziel bleibt fest) und drei Balken für Eiweiß, Kohlenhydrate und Fett. Keine Wertung.
public class NutritionWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    private static void bar(Context c, RemoteViews v, int bar, int text, String key) {
        int value = WidgetData.today(c, key);
        int t = WidgetData.prefs(c).getInt(key + "Goal", 0); // fertige Ziele aus der App, wie dort berechnet
        v.setProgressBar(bar, 100, t > 0 ? Math.min(100, value * 100 / t) : 0, false);
        v.setTextViewText(text, t > 0 ? value + " / " + t + " g" : value + " g");
    }

    private static RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_nutrition);
        int kcal = WidgetData.today(c, "kcal");
        int goal = WidgetData.prefs(c).getInt("goal", 0);
        if (goal > 0) {
            v.setTextViewText(R.id.nw_big, String.valueOf(Math.abs(goal - kcal)));
            v.setTextViewText(R.id.nw_unit, c.getString(kcal > goal ? R.string.widget_over : R.string.widget_left));
        } else {
            v.setTextViewText(R.id.nw_big, String.valueOf(kcal));
            v.setTextViewText(R.id.nw_unit, "kcal");
        }
        bar(c, v, R.id.nw_bar_p, R.id.nw_val_p, "protein");
        bar(c, v, R.id.nw_bar_c, R.id.nw_val_c, "carbs");
        bar(c, v, R.id.nw_bar_f, R.id.nw_val_f, "fat");
        v.setOnClickPendingIntent(R.id.nw_root, WidgetData.open(c));
        v.setOnClickPendingIntent(R.id.nw_add, WidgetData.action(c, "camera"));
        return v;
    }
}
