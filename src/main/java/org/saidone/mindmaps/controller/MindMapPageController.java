/*
 * Alice's Simple Mind Maps
 * Copyright (C) 2026 Miss Alice & Saidone
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

package org.saidone.mindmaps.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.val;
import org.saidone.mindmaps.dto.CreateMindMapRequest;
import org.saidone.mindmaps.dto.MapGenerationRequestDto;
import org.saidone.mindmaps.service.MindMapService;
import org.saidone.mindmaps.service.MapGameService;
import org.saidone.mindmaps.service.ai.MapGenerationTaskService;
import org.saidone.mindmaps.service.ai.MapGenerationApplicationService;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequiredArgsConstructor
@RequestMapping("/maps")
public class MindMapPageController {

    private final MindMapService mindMapService;
    private final MapGameService mapGameService;
    private final MapGenerationApplicationService mapGenerationApplicationService;
    private final MapGenerationTaskService mapGenerationTasks;

    @GetMapping
    public String list(Model model, Principal principal) {
        model.addAttribute("username", principal.getName());
        if (!model.containsAttribute("mapForm")) {
            model.addAttribute("mapForm", new CreateMindMapRequest());
        }
        model.addAttribute("maps", mindMapService.findAll());
        return "maps/list";
    }

    @PostMapping
    public String create(@Valid @ModelAttribute("mapForm") CreateMindMapRequest mapForm,
                         BindingResult bindingResult,
                         Model model,
                         Principal principal,
                         RedirectAttributes redirectAttributes) {
        if (bindingResult.hasErrors()) {
            model.addAttribute("username", principal.getName());
            model.addAttribute("maps", mindMapService.findAll());
            return "maps/list";
        }
        val map = mindMapService.create(mapForm);
        redirectAttributes.addFlashAttribute("autoLayoutOnOpen", true);
        return String.format("redirect:/maps/%s", map.getId());
    }

    @PostMapping("/template/{templateKey}")
    public String createTemplate(@PathVariable String templateKey, RedirectAttributes redirectAttributes) {
        val map = mindMapService.createFromTemplate(templateKey);
        redirectAttributes.addFlashAttribute("autoLayoutOnOpen", true);
        return String.format("redirect:/maps/%s", map.getId());
    }

    @PostMapping("/ai")
    public String createWithAi(@RequestParam("topic") String topic,
                               @RequestParam(name = "maxDepth", defaultValue = "3") Integer maxDepth,
                               @RequestParam(name = "includeBranchText", defaultValue = "false") boolean includeBranchText,
                               @RequestParam(name = "searchWikimediaImages", defaultValue = "false") boolean searchWikimediaImages,
                               RedirectAttributes redirectAttributes) {
        val request = new MapGenerationRequestDto();
        request.setTopic(topic);
        request.setMaxDepth(Math.clamp(maxDepth, 1, 6));
        request.setIncludeBranchText(includeBranchText);
        request.setIncludeWikimediaImages(searchWikimediaImages);
        try {
            val generated = mapGenerationApplicationService.generateMindMap(request);
            val map = mindMapService.createFromGeneratedMap(generated, searchWikimediaImages);
            redirectAttributes.addFlashAttribute("autoLayoutOnOpen", true);
            return String.format("redirect:/maps/%s", map.getId());
        } catch (RuntimeException ex) {
            redirectAttributes.addFlashAttribute("aiError", ex.getMessage());
            return "redirect:/maps";
        }
    }

    @GetMapping("/ai/{taskId}/open")
    public String openGeneratedMap(@PathVariable UUID taskId, Principal principal, RedirectAttributes attributes) {
        val progress = mapGenerationTasks.get(taskId, principal.getName());
        if (progress.status() != MapGenerationTaskService.Status.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La mappa non è ancora pronta.");
        }
        attributes.addFlashAttribute("autoLayoutOnOpen", true);
        return "redirect:/maps/" + progress.mapId();
    }

    @GetMapping("/{id}")
    public String editor(@PathVariable Long id, Model model, Principal principal) {
        model.addAttribute("username", principal.getName());
        model.addAttribute("map", mindMapService.findMapWithNodes(id));
        model.addAttribute("publicToken", mapGameService.publicToken(id));
        return "maps/editor";
    }

    @PostMapping("/{id}/prizes")
    public String updatePrizes(@PathVariable Long id, @RequestParam("prizes") java.util.List<String> prizes,
                                   RedirectAttributes attributes) {
        try {
            mindMapService.updatePrizes(id, prizes);
            attributes.addFlashAttribute("publicationMessage", "Titoli premio salvati. Aggiorna il gioco pubblicato per condividerli.");
        } catch (IllegalArgumentException ex) {
            attributes.addFlashAttribute("publicationMessage", ex.getMessage());
        }
        return "redirect:/maps/" + id;
    }

    @PostMapping("/{id}/publish")
    public String publish(@PathVariable Long id, RedirectAttributes attributes) {
        try {
            mapGameService.publish(id);
            attributes.addFlashAttribute("publicationMessage", "Gioco pubblicato. Puoi condividere il link pubblico.");
        } catch (IllegalArgumentException ex) {
            attributes.addFlashAttribute("publicationMessage", ex.getMessage());
        }
        return "redirect:/maps/" + id;
    }

    @PostMapping("/{id}/unpublish")
    public String unpublish(@PathVariable Long id) {
        mapGameService.unpublish(id);
        return "redirect:/maps/" + id;
    }

    @PostMapping("/{id}/clone")
    public String clone(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        val clonedMap = mindMapService.cloneMap(id);
        redirectAttributes.addFlashAttribute("message", "Mappa clonata.");
        return String.format("redirect:/maps/%s", clonedMap.getId());
    }

    @PostMapping("/{id}/delete")
    public String delete(@PathVariable Long id, RedirectAttributes redirectAttributes) {
        mindMapService.deleteMap(id);
        redirectAttributes.addFlashAttribute("message", "Mappa eliminata.");
        return "redirect:/maps";
    }
}
