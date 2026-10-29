package ma.fsbm.pfa.dermai.web;

import ma.fsbm.pfa.dermai.dto.AdminDtos.Dashboard;
import ma.fsbm.pfa.dermai.service.StatsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final StatsService stats;

    public DashboardController(StatsService stats) {
        this.stats = stats;
    }

    @GetMapping
    public Dashboard dashboard() {
        return stats.dashboard();
    }
}
