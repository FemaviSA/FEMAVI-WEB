' Corre el sincronizador sin abrir ventanas (lo usa la tarea programada).
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
sh.Run """" & dir & "\node.exe"" --max-old-space-size=1024 """ & dir & "\sincronizar.js""", 0, True
