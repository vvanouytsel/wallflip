# Sets the wallpaper of one Windows monitor, picked by its top-left corner in screen pixels.
param([string]$Path, [int]$Left, [int]$Top, [switch]$All)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct WfRect { public int Left, Top, Right, Bottom; }

[ComImport, Guid("B92B56A9-8B55-4E14-9A89-0199BBB6F93B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IDesktopWallpaper {
    void SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID, [MarshalAs(UnmanagedType.LPWStr)] string wallpaper);
    [return: MarshalAs(UnmanagedType.LPWStr)] string GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID);
    [return: MarshalAs(UnmanagedType.LPWStr)] string GetMonitorDevicePathAt(uint monitorIndex);
    uint GetMonitorDevicePathCount();
    WfRect GetMonitorRECT([MarshalAs(UnmanagedType.LPWStr)] string monitorID);
    void SetBackgroundColor(uint color);
    uint GetBackgroundColor();
    void SetPosition(int position);
}

[ComImport, Guid("C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD")]
public class DesktopWallpaperClass { }

public static class WfWallpaper {
    public static bool Set(string path, int left, int top, bool all) {
        var wp = (IDesktopWallpaper)new DesktopWallpaperClass();
        wp.SetPosition(4); // fill the screen
        bool done = false;
        uint count = wp.GetMonitorDevicePathCount();
        for (uint i = 0; i < count; i++) {
            string id = wp.GetMonitorDevicePathAt(i);
            WfRect r = wp.GetMonitorRECT(id);
            if (all || (r.Left == left && r.Top == top)) {
                wp.SetWallpaper(id, path);
                done = true;
            }
        }
        return done;
    }
}
"@

if (-not [WfWallpaper]::Set($Path, $Left, $Top, [bool]$All)) {
    Write-Error "No monitor found at $Left,$Top"
    exit 1
}
