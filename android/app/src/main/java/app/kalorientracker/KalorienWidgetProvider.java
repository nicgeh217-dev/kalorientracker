package app.kalorientracker;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

// Kleines Widget: die heutigen Kalorien, ein Tipp öffnet die Kamera. Nur die Zahl, kein Ziel und keine Wertung.
public class KalorienWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    private static RemoteViews views(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_kalorien);
        views.setTextViewText(R.id.widget_kcal, context.getString(R.string.widget_kcal_value, WidgetData.today(context, "kcal")));
        views.setOnClickPendingIntent(R.id.widget_root, WidgetData.action(context, "camera"));
        return views;
    }
}
