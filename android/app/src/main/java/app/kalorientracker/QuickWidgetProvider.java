package app.kalorientracker;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;

// Schnellzugriff: vier Knöpfe, die direkt Foto, Strichcode, Training und Gewicht öffnen.
public class QuickWidgetProvider extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_quick);
        v.setOnClickPendingIntent(R.id.qw_camera, WidgetData.action(context, "camera"));
        v.setOnClickPendingIntent(R.id.qw_barcode, WidgetData.action(context, "barcode"));
        v.setOnClickPendingIntent(R.id.qw_workout, WidgetData.action(context, "workout"));
        v.setOnClickPendingIntent(R.id.qw_weight, WidgetData.action(context, "weight"));
        for (int id : ids) manager.updateAppWidget(id, v);
    }
}
