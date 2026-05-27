from django.shortcuts import render
from django.http import JsonResponse
from django.utils import timezone
import heapq, re, os, csv
from django.conf import settings
from xhtml2pdf import pisa
from django.template.loader import get_template
from datetime import datetime

TOTAL_SLOTS = 105
SLOTS_PER_PAGE = 20
RATE_FIRST_HOUR = 20
RATE_PER_30MIN = 10

free_slots_heap = []
parked_vehicles = {}

# Daily and monthly summary tracking
summary = {
    'daily': {
        'date': datetime.now().date(),
        'total_cars': 0,
        'total_revenue': 0,
        'logs': []
    },
    'monthly': {
        'month': datetime.now().month,
        'year': datetime.now().year,
        'logs': []
    }
}

def init_heap():
    global free_slots_heap
    if not free_slots_heap:
        free_slots_heap = list(range(1, TOTAL_SLOTS + 1))
        heapq.heapify(free_slots_heap)

def is_valid_vehicle_number(vnum):
    return bool(re.match(r'^[A-Z0-9]{1,10}$', vnum))

def save_pdf(template_path, context, filename):
    template = get_template(template_path)
    html = template.render(context)
    pdf_path = os.path.join(settings.MEDIA_ROOT, filename)
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    with open(pdf_path, "wb") as f:
        result = pisa.CreatePDF(html, dest=f)
        if result.err:
            print(f"PDF generation error for {filename}")
    return f"{settings.MEDIA_URL}{filename}"

def generate_slip_pdf(vnum, slot, entry_time):
    return save_pdf(
        "entry_slip.html",
        {"vehicle_number": vnum, "slot_number": slot, "entry_time": entry_time},
        f"{vnum}_slip.pdf"
    )

def generate_pdf(vnum, slot, entry_time, exit_time, duration, fee):
    return save_pdf(
        "bill.html",
        {
            "vehicle_number": vnum,
            "slot_number": slot,
            "entry_time": entry_time,
            "exit_time": exit_time,
            "duration": round(duration, 2),
            "fee": fee
        },
        f"{vnum}_bill.pdf"
    )

def save_daily_csv():
    today = summary['daily']['date'].strftime("%d-%m-%y")
    filename = os.path.join(settings.MEDIA_ROOT, f"{today}.csv")
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    with open(filename, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(['Vehicle Number','Slot','Entry Time','Exit Time','Fee'])
        for log in summary['daily']['logs']:
            writer.writerow([log['vehicle_number'], log['slot'], log['entry_time'], log['exit_time'], log['fee']])
    print(f"Daily CSV saved: {filename}")

def save_monthly_csv():
    month_year = datetime(summary['monthly']['year'], summary['monthly']['month'], 1).strftime("%b%Y")
    filename = os.path.join(settings.MEDIA_ROOT, f"{month_year}.csv")
    os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
    with open(filename, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(['Vehicle Number','Slot','Entry Time','Exit Time','Fee'])
        for log in summary['monthly']['logs']:
            writer.writerow([log['vehicle_number'], log['slot'], log['entry_time'], log['exit_time'], log['fee']])
    print(f"Monthly CSV saved: {filename}")

def dashboard(request):
    init_heap()
    page = int(request.GET.get("page",1))
    start_idx = (page-1)*SLOTS_PER_PAGE
    end_idx = start_idx + SLOTS_PER_PAGE

    if request.method=="POST" and request.headers.get("x-requested-with")=="XMLHttpRequest":
        action = request.POST.get("action")
        vnum = request.POST.get("vehicle_number","").upper()
        response_data = {}

        if not is_valid_vehicle_number(vnum):
            return JsonResponse({"error":"Invalid vehicle number."})

        # ENTRY
        if action=="entry":
            if vnum in parked_vehicles:
                response_data["error"]=f"Vehicle {vnum} is already parked."
            elif not free_slots_heap:
                response_data["error"]="Parking full."
            else:
                slot = heapq.heappop(free_slots_heap)
                entry_time = timezone.now()
                parked_vehicles[vnum] = {"slot": slot, "entry_time": entry_time}
                slip_url = generate_slip_pdf(vnum, slot, entry_time)
                response_data.update({
                    "success":f"Vehicle {vnum} parked at slot {slot}.",
                    "slip_url": slip_url
                })

        # EXIT
        elif action=="exit":
            if vnum not in parked_vehicles:
                response_data["error"]=f"Vehicle {vnum} not found in parking."
            else:
                info = parked_vehicles.pop(vnum)
                slot = info["slot"]
                entry_time = info["entry_time"]
                exit_time = timezone.now()
                duration = (exit_time-entry_time).total_seconds()/60
                fee = RATE_FIRST_HOUR if duration<=60 else RATE_FIRST_HOUR + int(-(-(duration-60)//30))*RATE_PER_30MIN
                heapq.heappush(free_slots_heap, slot)
                pdf_url = generate_pdf(vnum, slot, entry_time, exit_time, duration, fee)

                # Daily reset check
                today = datetime.now().date()
                if summary['daily']['date'] != today:
                    save_daily_csv()
                    summary['daily']={'date':today,'total_cars':0,'total_revenue':0,'logs':[]}

                # Monthly reset check
                now_month = datetime.now().month
                now_year = datetime.now().year
                if summary['monthly']['month']!=now_month or summary['monthly']['year']!=now_year:
                    save_monthly_csv()
                    summary['monthly']={'month':now_month,'year':now_year,'logs':[]}

                # Update summaries
                summary['daily']['total_cars'] += 1
                summary['daily']['total_revenue'] += fee
                summary['daily']['logs'].append({
                    "vehicle_number":vnum,"slot":slot,
                    "entry_time":entry_time.strftime("%Y-%m-%d %H:%M"),
                    "exit_time":exit_time.strftime("%Y-%m-%d %H:%M"),
                    "fee":fee
                })

                summary['monthly']['logs'].append({
                    "vehicle_number":vnum,"slot":slot,
                    "entry_time":entry_time.strftime("%Y-%m-%d %H:%M"),
                    "exit_time":exit_time.strftime("%Y-%m-%d %H:%M"),
                    "fee":fee
                })
                save_daily_csv()
                save_monthly_csv()

                response_data.update({
                    "success":f"Vehicle {vnum} exited. Fee: ₹{fee}",
                    "pdf_url":pdf_url,
                    "total_cars":summary['daily']['total_cars'],
                    "total_revenue":summary['daily']['total_revenue']
                })

        # Update slots info
        slots_list=[{"number":i,"occupied":i not in free_slots_heap} for i in range(1,TOTAL_SLOTS+1)]
        paginated_slots=slots_list[start_idx:end_idx]
        total_pages=(TOTAL_SLOTS+SLOTS_PER_PAGE-1)//SLOTS_PER_PAGE

        response_data.update({
            "slots":paginated_slots,
            "available_count":len(free_slots_heap),
            "occupied_count":TOTAL_SLOTS-len(free_slots_heap),
            "current_page":page,
            "total_pages":total_pages
        })

        return JsonResponse(response_data)

    # Normal GET
    slots_list=[{"number":i,"occupied":i not in free_slots_heap} for i in range(1,TOTAL_SLOTS+1)]
    paginated_slots=slots_list[start_idx:end_idx]
    total_pages=(TOTAL_SLOTS+SLOTS_PER_PAGE-1)//SLOTS_PER_PAGE

    search_number=request.GET.get("search","").upper()
    search_result=None
    search_message=""
    if search_number:
        if search_number in parked_vehicles:
            info=parked_vehicles[search_number]
            search_result=[{"vehicle_number":search_number,"slot":info["slot"],"entry_time":info["entry_time"]}]
        else:
            search_message=f"Vehicle {search_number} not found in parking."

    return render(request,"dashboard.html",{
        "slots":paginated_slots,
        "available_count":len(free_slots_heap),
        "occupied_count":TOTAL_SLOTS-len(free_slots_heap),
        "search_result":search_result,
        "search_message":search_message,
        "search_number":search_number,
        "current_page":page,
        "total_pages":total_pages,
        "total_cars":summary['daily']['total_cars'],
        "total_revenue":summary['daily']['total_revenue']
    })
