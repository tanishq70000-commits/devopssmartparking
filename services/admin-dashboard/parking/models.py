from django.db import models

class ParkingSlot(models.Model):
    slot_number = models.PositiveIntegerField(unique=True)
    is_occupied = models.BooleanField(default=False)

    def __str__(self):
        return f"Slot {self.slot_number}"

class Vehicle(models.Model):
    vehicle_number = models.CharField(max_length=20, unique=True)
    slot = models.ForeignKey(ParkingSlot, on_delete=models.SET_NULL, null=True)
    entry_time = models.DateTimeField(auto_now_add=True)
    exit_time = models.DateTimeField(null=True, blank=True)
    fee = models.FloatField(default=0)

    def __str__(self):
        return self.vehicle_number
