package app.kalorientracker;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import java.text.NumberFormat;
import java.util.Locale;

// Körper: Schlaf, Schritte und Ruhepuls von heute aus Health Connect. Fehlt ein Wert, steht ein Strich.
public class BodyWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    private static RemoteViews views(Context c) {
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_body);
        int sleep = WidgetData.today(c, "sleepMin");
        int steps = WidgetData.today(c, "steps");
        int hr = WidgetData.today(c, "restingHr");
        v.setTextViewText(R.id.bw_sleep, sleep > 0 ? (sleep / 60) + " h " + (sleep % 60) + " min" : "–");
        v.setTextViewText(R.id.bw_steps, steps > 0 ? NumberFormat.getIntegerInstance(Locale.GERMANY).format(steps) : "–");
        v.setTextViewText(R.id.bw_hr, hr > 0 ? hr + " bpm" : "–");
        v.setOnClickPendingIntent(R.id.bw_root, WidgetData.open(c));
        return v;
    }
}
