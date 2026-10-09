# Registra en el Programador de tareas de Windows el envío de las tandas de
# captación. Se ejecuta una vez; enviar_tanda.py decide en cada disparo si toca
# enviar (día, hora, tanda pendiente, web viva, interruptor de parada).
#
#   Disparos: martes, miércoles y jueves a las 10:30, y un reintento a las 11:30
#   (no hace nada si ya se envió). El equipo puede estar suspendido: se le pide
#   que despierte. Si estaba apagado, al encenderse reintenta; pero fuera de
#   10:00-12:30 el propio script se niega a enviar.
#
#   Para pararlo todo:  schtasks /Delete /TN CitaLista-Envio-Tandas /F
#   Para pausar:        crear el fichero prospect-system\data\PAUSAR_ENVIOS
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $raiz 'venv\Scripts\python.exe'
$accion = New-ScheduledTaskAction -Execute $python -Argument 'enviar_tanda.py' -WorkingDirectory $raiz
$dias = 'Tuesday','Wednesday','Thursday'
$disparos = @(
  New-ScheduledTaskTrigger -Weekly -DaysOfWeek $dias -At '10:30'
  New-ScheduledTaskTrigger -Weekly -DaysOfWeek $dias -At '11:30'
)
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'CitaLista-Envio-Tandas' -Action $accion -Trigger $disparos `
  -Settings $ajustes -Principal $principal -Force `
  -Description 'Envía las tandas de correos de captación de Cita-Lista (ver enviar_tanda.py).' | Out-Null
Get-ScheduledTask -TaskName 'CitaLista-Envio-Tandas' | Get-ScheduledTaskInfo | Format-List TaskName, NextRunTime, LastTaskResult
